#!/usr/bin/env node

/**
 * CLI Interface for Coin Allocator
 *
 * Todo:
 *  - (eventually) add --exchange param
 */

var readline = require('readline');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var Table = require('cli-table');
require('colors'); // this one just mucks with String.prototype. :(

var CoinAllocator = require('./CoinAllocator.js');

var argv = require('yargs')
    .usage('Suggests and, optionally executes, trades to make your current allocation match your target allocation.\nUsage: --public-key 1a2b3d.. --private-key 4f5a6b... --allocation.BTC 50 --allocation.LTC 50')
    .options({
        'public-key': {
            describe: 'API public key, defaults to CRYPTSY_PUBLIC_KEY environment variable'
        },
        'private-key': {
            describe: 'API private key, defaults to CRYPTSY_PRIVATE_KEY environment variable'
        },
        primary: {
            describe: 'Primary currency - all other currencies must be tradable to and from this currency.',
            default: 'BTC'
        },
        allocation: {
            describe: 'Add `--allocation.SYMBOL %` for each currency you want. Ex: `--allocation.BTC 30` for 30% BTC',
            demand: 'At least one --allocation.SYMBOL % argument is required. For example, `--allocation.BTC 60 --allocation.LTC 40` for a 60%/40% split between BTC and LTC,'
        },
        yes: {
            describe: 'Automatically execute the suggested trades without asking for confirmation',
            alias: 'y'
        },
        trade: {
            describe: 'Set the --no-trade flag to prevent Coin Allocator from offering to execute suggested trades. Not compatible with the --yes option.',
            boolean: undefined,
            default: true
        },
        'compute-gains': {
            describe: 'Computes the overal % gain on your trades, enabled by default. May be time-intensive, so setting --no-compute-gains will skip it.',
            boolean: undefined,
            default: true
        }
    })
    .check(function(argv) {
        argv.publicKey = argv['public-key'] || process.env.CRYPTSY_PUBLIC_KEY;
        argv.privateKey = argv['private-key'] || process.env.CRYPTSY_PRIVATE_KEY;
        if (!argv.publicKey || !argv.privateKey) throw 'CRYPTSY_PUBLIC_KEY and CRYPTSY_PRIVATE_KEY env vars must be set';
        if (argv.yes && !argv.trade) throw '--yes and --no-trade are mutually exclusive';
    })
    .argv;

var ca = new CoinAllocator({
    allocation: argv.allocation,
    primaryCurrency: argv.primary,
    publicKey: argv.publicKey,
    privateKey: argv.privateKey
});


console.log('fetching current data...');

var steps = {
    status: ca.getStatus.bind(ca),
};

if (argv['compute-gains']) {
    steps.gains = ['status',
        function(callback, results) {
            console.log('fetching history to compute gains...');
            ca.getTradeGains(results.status, callback);
        }
    ];
}

async.auto(steps, function(err, results) {
    if (err) {
        if (_.contains(err.message, '<html>')) {
            console.error(err.message);
            console.error('Remote API appears to be down, please try again in a few minutes\n');
            return process.exit(2);
        }
        console.error(err.stack || err);
        process.exit(1);
    }
    var status = results.status;
    var gains = results.gains;
    var rows = _.chain(_.zip(
        _.pairs(status.balances), // ex: [['BTC', 1], ['LTC', 2]]
        _.pairs(status.allocation), // ex: [['BTC', 50], ['LTC', 50]]
        _.pairs(status.targetBalances),
        _.pairs(argv.allocation)
    ))
        .map(function(row) {
            // in theory, I should be able to call these with _.invoke, but it doesn't seem to receive the correct value
            return _.chain(row).flatten().unique().value();
        })
        .map(function(row) {
            // row is now an array of [0: currency, 1: balance, 2: %, 3: target balance, 4: target %]
            return [
                row[0],
                row[1].toFixed(8),
                row[2].toFixed(2),
                row[3].toFixed(8),
                row[4].toFixed(2),
            ];
        })
        .value();


    // instantiate
    var statusTable = new Table({
        head: ['Currency', 'Current Allocation', '(%)', 'Target Allocation', '(%)'],
        colAligns: ['left', 'right', 'right', 'right', 'right'],
        style: {
            head: ['cyan']
        }
    });

    // table is an Array, so you can `push`, `unshift`, `splice` and friends
    statusTable.push.apply(statusTable, rows);

    console.log(statusTable.toString());
    console.log('Current Allocation % is based on each currencie\'s value in %s.', argv.primary);


    if (gains) {
        console.log("\nOverall gain due to trading: %s%" [gains > 0 ? 'green' : 'red'], (gains * 100).toFixed(2));
    }


    var suggestedTrades = ca.getSuggestedTrades(status);
    if (!suggestedTrades.getTrades().length) {
        console.log('\nNo trades recommended at this time.\n');
        process.exit();
    }

    var suggestedTradesTable = new Table({
        head: ['Suggested Trades'],
        style: {
            head: ['cyan']
        }
    });
    suggestedTrades.getTrades().forEach(function(trade) {
        suggestedTradesTable.push([util.format("%s %s => %s", trade.getAmount(), trade.getFrom(), trade.getTo())]);
    });
    console.log(suggestedTradesTable.toString());

    // if the --no-trade flag was set, then stop here.
    if (!argv.trade) {
        process.exit(0);
    }

    var ordersOpen = false;

    function cancelAllOrders(cb) {
        console.warn('\nCanceling all outstanding orders...');
        ca.cancelAllOrders(function(err, cancelations) {
            if (err) {
                console.error('Error canceling orders: ', err);
                return process.exit(4);
            }
            console.log('Orders canceled: ', cancelations);
            if (cb) {
                cb();
            }
        });
        ordersOpen = false;
    }

    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function handleResponse(response) {
        // todo: figure out how to kill the prompt and prevent/ignore additional user input after the first yes/no
        response = response.toLowerCase();
        if (response == 'yes') { // not sure why node wraps parenthesis around the command...
            ordersOpen = true;
            var error = false;
            console.log('\nExecuting, press control-c to cancel and kill any outstanding orders');
            var i = 0;
            var spinEls = ['-', '\\', '|', '/'];
            ca.executeTrades(suggestedTrades)
                .on('executing', function(trade, orderId, order) {
                    console.log('Executing trade:\n Trade: %s\n order: %j\n Order ID: %s', trade.toString(), order, orderId);
                    process.stdout.write('...');
                })
                .on('executed', function(tradeid) {
                    process.stdout.write(' Done! Trade ID: ', tradeid);
                })
                .on('orderProgress', function(completed, total) {
                    process.stdout.clearLine();
                    process.stdout.cursorTo(0);
                    var spinEl = spinEls[i];
                    i++;
                    if (i >= spinEls.length) i = 0;
                    process.stdout.write(util.format('%s/%s (%s%) %s', completed, total, Math.round(completed / total * 100), spinEl));
                })
                .on('error', function(err) {
                    error = true;
                    console.error('\nError executing trades: ', err);
                    cancelAllOrders(function() {
                        process.exit(3);
                    });
                })
                .on('done', function() {
                    ordersOpen = false;
                    if (!error) {
                        console.log('All trades executed!');
                        process.exit();
                    }
                });
        } else if (response == 'no') {
            process.exit();
        } else {
            rl.question('Please type "yes" or "no": ', handleResponse);
        }
    }
    rl.on('close', function() {
        if (ordersOpen) cancelAllOrders(function() {
            process.exit();
        });
    });
    if (argv.yes) {
        handleResponse('yes');
    } else {
        rl.question('Execute these trades? (yes/no): ', handleResponse);
    }
});
