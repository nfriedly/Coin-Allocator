/**
Cryptsy API

https://www.cryptsy.com/pages/api

http://pubapi.cryptsy.com/api.php?method=marketdatav2

"DOGE\/LTC":{"marketid":"135"
"DOGE\/BTC":{"marketid":"132"
"LTC\/BTC":{"marketid":"3",
"marketid":"5","label":"FTC\/BTC"

**/
// configuration
var publicKey = process.env.CRYPTSY_PUBLIC_KEY;
var privateKey = process.env.CRYPTSY_PRIVATE_KEY;
var currencies = ['BTC', 'LTC', 'DOGE'];
var primaryCurrency = 'BTC';

if (!publicKey || !privateKey) throw 'CRYPTSY_PUBLIC_KEY and CRYPTSY_PRIVATE_KEY env vars must be set';

var Cryptsy = require('./exchanges/cryptsy');
var exchange = new Cryptsy(publicKey, privateKey);

var _ = require('lodash');
var async = require('async');
var util = require('util');

var d = require('domain').create();
d.on('error', function(err) {
    if (!err) { // this shouldn't happen, but better safe than sorry
        console.error("Unknown Error: " + err);
        return process.exit(3);
    }
    if (_.contains(err.message, '<html>')) {
        console.error(err.message);
        console.error('Remote API appears to be down, please try again in a few minutes');
        return process.exit(2);
    }
    console.error(err.stack || err);
    process.exit(1);
});
d.run(function() {

    function getRatio(targetCurrency, markets, currency) {
        if (currency == targetCurrency) {
            return 1;
        }
        if (markets[currency] && markets[currency][targetCurrency]) {
            return markets[currency][targetCurrency].ratio;
        }
        throw new Error(util.format('Unable to directly convert %s to %s, no market found', currency, targetCurrency));
    }

    function convertTo(targetCurrency, markets, amount, currency) {
        return amount * getRatio(targetCurrency, markets, currency);
    }

    console.log('fetching data...');
    async.auto({
        markets: function(cb) {
            exchange.getMarkets(currencies, cb);
        },
        balances: function(cb) {
            exchange.getBalances(currencies, cb);
        },
        balancesInPrimary: ['balances', 'markets',
            function(cb, results) {
                cb(null, _.mapValues(results.balances, convertTo.bind(null, primaryCurrency, results.markets)));
            }
        ],

        target: ['balances', 'balancesInPrimary',
            function(cb, results) {
                // todo: support %-based targets in addition to even splitting
                var totalInPrimary = _.reduce(results.balancesInPrimary, function(sum, num) {
                    return sum + num;
                });
                var targetInPrimary = totalInPrimary / Object.keys(results.balances).length;
                var targetBalances = _.mapValues(results.balancesInPrimary, function(amount, currency) {
                    return targetInPrimary * getRatio(currency, results.markets, primaryCurrency);
                });
                cb(null, targetBalances);
            }
        ]
    }, d.intercept(function(results) {
        console.log("Current balances:", results.balances);
        console.log("Converted to BTC:", results.balancesInPrimary);
        console.log("Target after rebalancing:", results.target);
    }));
});
