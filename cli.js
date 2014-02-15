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
            console.error('Remote API appears to be down, please try again in a few minutes');
            return process.exit(2);
        }
        console.error(err.stack || err);
        process.exit(1);

    }

    console.log("Current balances:", status.balances);
    console.log("Converted to BTC:", status.balancesInPrimary);
    console.log("Target after rebalancing:", status.target);
    console.log("Suggested trades:\n", ca.getSuggestedTrades(status));
});
