/**
 * Coin Allocator
 * Takes your current balances in various crypto coins and the current market prices, and suggests a new allocation to even things out.
 * Future versions will automatically execute the transactions
 */


var _ = require('lodash');
var async = require('async');
var util = require('util');

function CoinAllocator(options) {

    // todo: support other exchanges via options
    var Cryptsy = require('./exchanges/cryptsy');
    this.options = options;
    this.primaryCurrency = options.primaryCurrency;
    this.exchange = new Cryptsy(options.publicKey, options.privateKey);
    this.currencies = options.currencies;
}

CoinAllocator.prototype.getRatio = function(targetCurrency, markets, currency) {
    if (currency == targetCurrency) {
        return 1;
    }
    if (markets[currency] && markets[currency][targetCurrency]) {
        return markets[currency][targetCurrency].ratio;
    }
    throw new Error(util.format('Unable to directly convert %s to %s, no market found', currency, targetCurrency));
};

CoinAllocator.prototype.getBalancesInPrimary = function(primaryCurrency, markets, balances) {
    return _.mapValues(balances, function(amount, currency) {
        return amount * this.getRatio(primaryCurrency, markets, currency);
    }, this);
};


CoinAllocator.prototype.getTargetBalances = function(primaryCurrency, markets, balances) {
    var balancesInPrimary = this.getBalancesInPrimary(primaryCurrency, markets, balances);
    var totalInPrimary = _.reduce(balancesInPrimary, function(sum, num) {
        return sum + num;
    });
    // todo: support %-based targets in addition to even splitting
    var targetInPrimary = totalInPrimary / Object.keys(balances).length;
    var targetBalances = _.mapValues(balancesInPrimary, function(amount, currency) {
        return targetInPrimary * this.getRatio(currency, markets, primaryCurrency);
    }, this);
    return targetBalances;
};

CoinAllocator.prototype.getBaselineSuggestedTrades = function(primaryCurrency, markets, balances, targetBalances) {
    var trades = [];
    _.each(targetBalances, function(amount, currency) {
        if (currency == primaryCurrency) return;
        var diff = balances[currency] - amount;
        if (diff > 0) {
            // shift because we want the SELLs to go first so that we don't try to spend more primary currency than we have
            trades.unshift({
                amount: diff,
                from: currency,
                to: primaryCurrency
            });
        }
        if (diff < 0) {
            // push because we want the BUYS to come second after we've already beefed up our primary currency
            trades.push({
                amount: Math.abs(diff) * this.getRatio(primaryCurrency, markets, currency),
                from: primaryCurrency,
                to: currency
            });
        }
    }, this);
    return trades;
};

CoinAllocator.prototype.getStatus = function(cb) {
    var self = this;
    async.parallel({
        markets: function(cb) {
            self.exchange.getMarkets(self.currencies, cb);
        },
        balances: function(cb) {
            self.exchange.getBalances(self.currencies, cb);
        }
    }, function(err, results) {
        if (err) return cb(err);
        var targetBalances = self.getTargetBalances(self.primaryCurrency, results.markets, results.balances);
        cb(null, {
            markets: results.markets,
            balances: results.balances,
            targetBalances: targetBalances
        });
    });
};

CoinAllocator.prototype.getSuggestedTrades = function(status) {
    var baselineSuggestedtrades = this.getBaselineSuggestedTrades(this.primaryCurrency, status.markets, status.balances, status.targetBalances);
    // todo: optimize these trades
    return baselineSuggestedtrades;
};

CoinAllocator.prototype.executeSuggestedTrades = function(cb) {
    this.getSuggestedTrades(function(err, trades) {
        cb(null, trades);
    });
};

module.exports = CoinAllocator;
