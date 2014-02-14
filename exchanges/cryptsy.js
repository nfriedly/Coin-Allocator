/** 
 * A quick wrapper around the existing Cryptsy npm module lib so that I have something to spy on in unit tests.
 * This should also allow for other exchanges to be easily swapped in.
 */

var _ = require('lodash');
var async = require('async');
var Cryptsy = require('cryptsy');

Cryptsy.prototype.getBalances = function(currencies, cb) {
    this.api('getinfo', null, function(err, info) {
        if (err) return cb(err);
        cb(null, _.chain(info.balances_available).pick(currencies).mapValues(function(strBal) {
            return +strBal; // convert the balance from a string to a number.
        }).value());
    });
};

Cryptsy.prototype.getMarkets = function(currencies, cb) {
    // todo: consider caching the marketids and then just fetching individual market prices
    var cryptsy = this;
    async.parallel({
        marketdata: function(cb) {
            cryptsy.api('marketdatav2', null, cb);
        },
        buyFee: function(cb) {
            cryptsy.api('calculatefees', {
                ordertype: 'Buy',
                quantity: 1,
                price: 1
            }, cb);
        },
        sellFee: function(cb) {
            cryptsy.api('calculatefees', {
                ordertype: 'Sell',
                quantity: 1,
                price: 1
            }, cb);
        }
    }, function(err, results) {
        if (err) return cb(err);
        var markets = {};
        _.each(results.marketdata.markets, function(market) {
            // todo: see if turning currencies into a map makes any appreciable performance difference here
            if (_.contains(currencies, market.primarycode) && _.contains(currencies, market.secondarycode)) {
                markets[market.primarycode] = markets[market.primarycode] || {};
                markets[market.primarycode][market.secondarycode] = {
                    ratio: +market.lasttradeprice,
                    fee: +results.sellFee.fee
                };

                markets[market.secondarycode] = markets[market.secondarycode] || {};
                markets[market.secondarycode][market.primarycode] = {
                    ratio: 1 / market.lasttradeprice,
                    fee: +results.buyFee.fee
                };
            }
        });
        cb(null, markets);
    });
};

module.exports = Cryptsy;
