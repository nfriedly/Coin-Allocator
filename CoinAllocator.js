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
    this.threshold = options.threshold / 100 || 0.01;
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

/**
 * Trade object, immutable.
 *
 * Example trade - convert $5 USD to BTC:
 * new Trade({from: 'USD', amount: 5, to: 'BTC'});
 */
function Trade(params) {
    var from = params.from,
        // bitcoin and friends can only be divided down to 8 decimal places. toFixed(8) rounds the amount if necessary and turns it into a string so that it doesn't get rendered as scientific notation
        amount = (typeof params.amount == 'string') ? params.amount : params.amount.toFixed(8),
        to = params.to;
    this.getFrom = function() {
        return from;
    };
    this.getAmount = function() {
        return amount;
    };
    this.getTo = function() {
        return to;
    };
}
/*  Todo: see if I can find a better place to put these
Trade.prototype.getToAmountWithoutFees(markets) {
    return this.getAmount() * markets[this.getFrom()][this.getTo()].ratio;
};
Trade.prototype.getToAmountWithFees = function() {
    var toAmount = this.getToAmountWithoutFees();
    return toAmount - (toAmount * markets[this.getFrom()][this.getTo()].fee);
};
*/
Trade.prototype.toJSON = function() {
    return {
        from: this.getFrom(),
        amount: this.getAmount(),
        to: this.getTo()
    };
};
Trade.prototype.toString = function() {
    return "Trade<" + JSON.stringify(this.toJSON()) + ">";
};

/**
 * An immutable list of trades.
 *
 * All elements must be Trade objects
 *
 */
function TradeSet(trades) {
    if (!_.every(trades, function(trade) {
        return trade instanceof Trade;
    })) {
        throw new Error('All elements passed to a TradeSet must be Trade objects');
    }
    trades = trades.slice(); // prevent changes to the source array from affecting the internal one
    this.getTrades = function() {
        return trades.slice(); // prevent changes to the given array from affecting the internal one
    };
}

TradeSet.prototype.toJSON = function() {
    return _.invoke(this.getTrades(), Trade.prototype.toJSON);
};
TradeSet.prototype.toString = function() {
    return "TradeSet<" + JSON.stringify(this.toJSON()) + ">";
};


CoinAllocator.prototype.getBaselineSuggestedTrades = function(primaryCurrency, markets, balances, targetBalances) {
    var trades = [];
    _.each(targetBalances, function(amount, currency) {
        if (currency == primaryCurrency) return;
        var diff = balances[currency] - amount;
        if (diff > 0) {
            // shift because we want the SELLs to go first so that we don't try to spend more primary currency than we have
            trades.unshift(new Trade({
                from: currency,
                amount: diff,
                to: primaryCurrency
            }));
        }
        if (diff < 0) {
            // push because we want the BUYS to come second after we've already beefed up our primary currency
            trades.push(new Trade({
                from: primaryCurrency,
                amount: Math.abs(diff) * this.getRatio(primaryCurrency, markets, currency),
                to: currency
            }));
        }
    }, this);
    return new TradeSet(trades);
};

/**
 * Take a given TradeSet and look for optimizations to reduce fees.
 * Potential future enhancement includes looking for arbitrage opportunities
 *
 * Recursively calls itself until it can no longer find any improvements to make, then returns the resulting trade set.
 */
CoinAllocator.prototype.optimizeTrades = function(primaryCurrency, markets, balances, targetBalances, threshold, tradeSet) {
    var trades = tradeSet.getTrades();
    if (trades.length > 10) throw 'die!';
    var sells = [];
    var buys = [];
    trades.forEach(function(trade) {
        if (trade.getFrom() == primaryCurrency) {
            buys.push(trade);
        } else if (trade.getTo() == primaryCurrency) {
            sells.push(trade);
        }
        // else it's already been optimized and we're not going to look at it.
    });

    // b-a because we want to work with larger amounts first
    buys.sort(function(a, b) {
        return b.amount - a.amount;
    });
    sells.sort(function(a, b) {
        var aAmountInPrimary = a.getAmount() * markets[a.getFrom()][primaryCurrency].ratio;
        var bAmountInPrimary = b.getAmount() * markets[b.getFrom()][primaryCurrency].ratio;
        return bAmountInPrimary - aAmountInPrimary;
    });

    var self = this;
    var changed = sells.some(function(sell) {
        return buys.some(function(buy) {
            var market = markets[sell.getFrom()][buy.getTo()];
            if (market) {
                trades = _.pull(trades, buy, sell);
                var buyAmountInSellCurrency = buy.getAmount() * self.getRatio(sell.getFrom(), markets, buy.getFrom());
                var newTransfer;
                if (sell.getAmount() == buyAmountInSellCurrency) {
                    // equal-sized buy and sell: replace both with a new direct order and cut the transaction fees in half
                    trades.push(new Trade({
                        from: sell.getFrom(),
                        to: buy.getTo(),
                        amount: sell.getAmount()
                    }));
                } else if (sell.getAmount() > buyAmountInSellCurrency) {
                    // large sell, small buy. Buy should come out of the sell directly instead of going through the primary currency and paying two transaction fees.
                    // todo: rename these to keep buy/sell on the original one and "transfer" on the new one
                    newTransfer = buy.toJSON();
                    var shrunkSell = sell.toJSON();
                    shrunkSell.amount = sell.getAmount() - buyAmountInSellCurrency;
                    newTransfer.from = sell.getFrom();
                    newTransfer.amount = buyAmountInSellCurrency;
                    trades.push(new Trade(shrunkSell), new Trade(newTransfer));
                } else {
                    // small sell, large buy. Sell should go directly towards the buy, bypassing the primary currency and saving some funds.
                    var newBuy = buy.toJSON();
                    newTransfer = sell.toJSON();
                    newTransfer.to = buy.getTo();
                    var sellAmountInBuyCurrency = sell.getAmount() * self.getRatio(buy.getFrom(), markets, sell.getFrom());
                    newBuy.amount = buy.getAmount() - sellAmountInBuyCurrency;
                    trades.push(new Trade(newTransfer), new Trade(newBuy));
                }
                return true;
            }
            return false;
        });
    });

    // If we found any optimizations, create a new TradeSet and look for more. Otherwise return the current TradeSet
    return changed ? this.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, new TradeSet(trades)) : tradeSet;
};

var MINIMUM_BTC_SIZE = parseFloat('1.0e-8');

CoinAllocator.prototype.removeTradesBelowThreshold = function(tradeSet, targetBalances, threshold) {
    var trades = tradeSet.getTrades();

    var filteredTrades = _.filter(trades, function(trade) {
        var amount = parseFloat(trade.getAmount());
        // todo: find market minimum trade amounts for each currency and use that instead
        if (amount < MINIMUM_BTC_SIZE) {
            return false;
        }
        return (amount / targetBalances[trade.getTo()]) > threshold;
    });

    return new TradeSet(filteredTrades);
};

CoinAllocator.prototype.getSuggestedTrades = function(status) {
    var baselineSuggestedtrades = this.getBaselineSuggestedTrades(this.primaryCurrency, status.markets, status.balances, status.targetBalances);
    var optimizedTrades = this.optimizeTrades(this.primaryCurrency, status.markets, status.balances, status.targetBalances, this.threshold, baselineSuggestedtrades);
    return this.removeTradesBelowThreshold(optimizedTrades, status.targetBalances, this.threshold);
};

CoinAllocator.prototype.executeTrades = function(trades, cb) {
    return this.exchange.executeTrades(trades, cb);
};

CoinAllocator.prototype.cancelAllOrders = function(cb) {
    return this.exchange.cancelAllOrders(cb);
};

module.exports = CoinAllocator;
module.exports.CoinAllocator = CoinAllocator;
module.exports.Trade = Trade;
module.exports.TradeSet = TradeSet;
