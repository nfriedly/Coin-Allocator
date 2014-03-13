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
        'compute-gains': {
            describe: 'Computes the overal % gain on your trades. May be time-intensive, so setting -g 0 will skip it.',
            alias: 'g',
            boolean: undefined,
            default: true
        }
    })
    .check(function(argv) {
        argv.publicKey = argv['public-key'] || process.env.CRYPTSY_PUBLIC_KEY;
        argv.privateKey = argv['private-key'] || process.env.CRYPTSY_PRIVATE_KEY;
        if (!argv.publicKey || !argv.privateKey) throw 'CRYPTSY_PUBLIC_KEY and CRYPTSY_PRIVATE_KEY env vars must be set';
    })
    .argv;

var ca = new CoinAllocator({
    allocation: argv.allocation,
    primaryCurrency: argv.primary,
    publicKey: argv.publicKey,
    privateKey: argv.privateKey
});


console.log('fetching data...');

var steps = {
    status: ca.getStatus.bind(ca),
};

if (argv['compute-gains']) {
    steps.gains = ['status',
        function(callback, results) {
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
    console.log("Current balances:", status.balances);
    if (gains) {
        console.log("Overall gain due to trading: %s%", (gains * 100).toFixed(2));
    }
    console.log("Current allocation (%):", status.allocation);
    console.log("Target after rebalancing:", status.targetBalances);
    var suggestedTrades = ca.getSuggestedTrades(status);
    if (!suggestedTrades.getTrades().length) {
        console.log('\nNo trades recommended at this time.\n');
        process.exit();
    }
    console.log("Suggested trades:\n", suggestedTrades.toString());

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
            console.log('Executing, press control-c to cancel and kill any outstanding orders');
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
