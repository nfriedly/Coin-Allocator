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

var marketIds = require('./data/cryptsy-market-ids.json');

var Cryptsy = require('cryptsy');
var cryptsy = new Cryptsy(publicKey, privateKey);

var _ = require('lodash');
var async = require('async');
var util = require('util');

var d = require('domain').create();
d.on('error', function(er) {
  console.error(er);
  process.exit(1);
});
d.run(function() {

    function api(name, params, cb) {
        cryptsy.api(name, params, d.intercept(cb));
    };
    
    function getRatio(targetCurrency, markets, currency) {
        if (currency == targetCurrency) {
            return 1;
        }
        var market = markets[currency + '/' + targetCurrency];
        if (market) {
            return market.lasttradeprice;
        }
        market = markets[targetCurrency + '/' + currency];
        if (market) {
            return 1 / market.lasttradeprice;
        }
        throw new Error(util.format('Unable to directly convert %s to %s, no market found', currency, targetCurrency));
    }
    
    function convertTo(targetCurrency, markets, amount, currency) {
        return amount * getRatio(targetCurrency, markets, currency);
    }
    
    console.log('fetching data...');
    async.auto({
        marketdatav2: cryptsy.api.bind(cryptsy, 'marketdatav2', null),
        markets: ['marketdatav2', function(cb, results) { 
            cb(null, results.marketdatav2.markets);
        }],
        
        getinfo: cryptsy.api.bind(cryptsy, 'getinfo', null),
        balances: ['getinfo', function(cb, results) {
            cb(null, _.pick(results.getinfo.balances_available, currencies));
        }],
        balancesInPrimary: ['balances', 'markets', function(cb, results) {
            cb(null, _.mapValues(results.balances, convertTo.bind(null, primaryCurrency, results.markets)));
        }],
        
        target: ['balances', 'balancesInPrimary', 'marketdatav2', function(cb, results) {
            // todo: support %-based targets in addition to even splitting
            var totalInPrimary = _.reduce(results.balancesInPrimary, function(sum, num) {
              return sum + num;
            });
            var targetInPrimary = totalInPrimary / Object.keys(results.balances).length;
            var targetBalances = _.mapValues(results.balancesInPrimary, function(amount, currency) {
               return targetInPrimary * getRatio(currency, results.markets, primaryCurrency); 
            });
            cb(null, targetBalances);
        }]
    }, d.intercept(function(results) {
        console.log("Current balances:", results.balances);
        console.log("Converted to BTC:", results.balancesInPrimary);
        console.log("Target after rebalancing:", results.target);
    }));
    
});

