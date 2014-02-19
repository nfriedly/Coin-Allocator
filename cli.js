#!/usr/bin/env node

/**
 * CLI Interface for Coin Allocator
 *
 * Todo:
 *  - Build proper CLI with optimist or the like
 *  - add --help command
 *  - require allocation targets from command line
 *  - require primary currency from command line
 *  - accept keys from cli in addition to env
 *  - add --no-execute option to suggest trades and exit
 *  - ask before making trades
 *  - add --yes option automatically make the trades without asking
 *  - (eventually) add --exchange param
 */

var repl = require('repl');
var util = require('util');
var _ = require('lodash');


// configuration
var publicKey = process.env.CRYPTSY_PUBLIC_KEY;
var privateKey = process.env.CRYPTSY_PRIVATE_KEY;

if (!publicKey || !privateKey) throw 'CRYPTSY_PUBLIC_KEY and CRYPTSY_PRIVATE_KEY env vars must be set';

var CoinAllocator = require('./CoinAllocator.js');

var ca = new CoinAllocator({
    currencies: ['BTC', 'LTC', 'DOGE'],
    primaryCurrency: 'BTC',
    publicKey: publicKey,
    privateKey: privateKey
});


console.log('fetching data...');
ca.getStatus(function(err, status) {
    if (err) {
        if (_.contains(err.message, '<html>')) {
            console.error(err.message);
            console.error('Remote API appears to be down, please try again in a few minutes\n');
            return process.exit(2);
        }
        console.error(err.stack || err);
        process.exit(1);

    }

    function cancelAllOrders() {
        console.warn('Canceling all outstanding orders...');
        ca.cancelAllOrders(function(err, cancelations) {
            if (err) {
                console.error('Error canceling orders: ', err);
                return process.exit(4);
            }
            console.log('Orders canceled: ', cancelations);
        });
    }
    console.log("Current balances:", status.balances);
    console.log("Target after rebalancing:", status.targetBalances);
    var suggestedTrades = ca.getSuggestedTrades(status);
    console.log("Suggested trades:\n", suggestedTrades.toString());
    var ordersStarted = false;
    repl.start({
        prompt: "Execute these trades? (yes/no): ",
        eval: function(cmd, context, filename, callback) {
            cmd = cmd.replace(/[^a-z]/ig, '').toLowerCase();
            if (cmd == 'yes' || cmd == '(yes)') { // not sure why node wraps parenthesis around the command...
                ordersStarted = true;
                console.log('Executing, press control-c to cancel and kill any outstanding orders');
                ca.executeTrades(suggestedTrades)
                    .on('executing', function(trade, order, orderId) {
                        console.log('Executing trade:\n Trade: %s\n order: %s\n Order ID: %s', trade.toString(), order, orderId);
                        process.stdout.write('...');
                    })
                    .on('executed', function(trade, orderId) {
                        process.stdout.write('Done! Order ID: ', orderId);
                    })
                    .on('orderProgress', function(completed, total) {
                        process.stdout.clearLine();
                        process.stdout.write(util.format('%s/%s (%s%)', completed, total, Math.round(completed / total * 100)));
                    })
                    .on('error', function(err) {
                        console.error('Error executing trades:');
                        console.error(err);
                        cancelAllOrders();
                        process.exit(3);
                    })
                    .on('done', function() {
                        console.log('All trades executed!');
                        process.exit();
                    });
            } else if (cmd == 'no' || cmd == '(no)') {
                process.exit();
            } else {
                console.error('Please type "yes" or "no", or run coin-allocator with the -y argument (%s)', cmd);
                callback();
            }
        }
    }).on('exit', function() {
        if (ordersStarted) cancelAllOrders();
        process.exit();
    });
});
