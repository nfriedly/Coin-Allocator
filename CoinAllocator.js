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
    this.allocation = options.allocation;
    this.currencies = Object.keys(this.allocation);
    var allocationTotal = CoinAllocator.sumObject(this.allocation);
    if (allocationTotal != 100) {
        throw new Error('Allocation percentages add up to 100, combined total was ' + allocationTotal);
    }
    this.threshold = options.threshold / 100 || 0.01;
}

// todo: consider moving this to a different file
// todo: rename this to just "sum" since it works on both arrays and objects
CoinAllocator.sumObject = function(obj) {
    return _.reduce(obj, function(sum, num) {
        return sum + num;
    }, 0);
};


CoinAllocator.prototype.getTradeGains = function(status, cb) {
    // per-currency gains: 
    // lookup deposits & withdrawals in selected currencies
    // lookup trades between selected currencies & non-selected currencies and treat them as additional deposits / withdrawls
    // calculate the total deposits & withdrawals in each currency
    // for each currency, calculate it's trade gain = (current balance + withdrawls - deposits) / deposits

    // overall gains:
    // convert totals into primary currency at current rate
    // combine totals into all deposits and all withdrawals
    // calculate current balance in primary currency
    // calculate overall trade gain = (current balance + withdrawals - deposits) / deposits
    var self = this;
    async.series({ // because of nonces, cryptsy's API sometimes chokes if we execute a second request before the first one completes
        transactions: function(cb) {
            self.exchange.getTransactionHistory(cb);
        },
        trades: function(cb) {
            self.exchange.getTradeHistory(cb);
        }
    }, function(err, results) {
        if (err) return cb(err);
        // results.transactions looks like {deposits: [], withdrawals: []}
        var transactions = _.mapValues(results.transactions, function(transactions) {
            return _.groupBy(transactions, function(transaction) {
                return transaction.currency;
            });
        });

        // a map of currencies we care about for quick lookups
        var tracking = _.mapValues(self.allocation, function() {
            return true;
        });

        // add an empty list if we didn't have any deposits/withdrawals in a given currency
        _.each(tracking, function(t, currency) {
            transactions.deposits[currency] = transactions.deposits[currency] || [];
            transactions.withdrawals[currency] = transactions.withdrawals[currency] || [];
        });

        _(results.trades).each(function(trade) {
            if (tracking[trade.toCurrency] && !tracking[trade.fromCurrency]) {
                // trades to a currency that we're tracking & from a currency that we're not tracking count as a deposit
                transactions.deposits[trade.toCurrency].push({
                    amount: trade.toAmount
                });
            } else if (tracking[trade.fromCurrency] && !tracking[trade.toCurrency]) {
                // trades from a currency that we're tracking & to a currency that we're not tracking count as a withdrawal
                transactions.withdrawals[trade.fromCurrency].push({
                    amount: trade.fromAmount
                });
            }
        });

        function sumTransactions(transactions) {
            return _.reduce(transactions, function(sum, trans) {
                return sum + parseFloat(trans.amount);
            }, 0);
        }

        var totals = _.mapValues(transactions, function(transactionsByCurrency /* lists of deposits or withdrawals, grouped by currency*/ ) {
            return _.mapValues(transactionsByCurrency, sumTransactions);
        });

        /*
        var gainsByCurrency = _.mapValues(status.balances, function(balance, currency) {
            return ((balance + totals.withdrawals[currency] - totals.deposits[currency]) / totals.deposits[currency] * 100).toFixed(2);
        });
        */

        /* returns {deposits: #, withdrawals: #} where # is the sum of all transactions of that type, converted to the primary currency at current values */
        var totalsInPrimary = _.mapValues(totals, function(transactionsByCurrency) {
            var totalsInPrimaryByCurrency = self.getBalancesInPrimary(self.primaryCurrency, status.markets, _.pick(transactionsByCurrency, self.currencies));
            var sumInPrimary = CoinAllocator.sumObject(totalsInPrimaryByCurrency);
            return sumInPrimary;
        });

        var balancesInPrimary = self.getBalancesInPrimary(self.primaryCurrency, status.markets, status.balances);
        var balanceInPrimary = CoinAllocator.sumObject(balancesInPrimary);

        var overallGains = (balanceInPrimary + totalsInPrimary.withdrawals - totalsInPrimary.deposits) / totalsInPrimary.deposits;

        cb(null, overallGains);
    });
};

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
    var totalInPrimary = CoinAllocator.sumObject(balancesInPrimary);
    var targetBalances = _.mapValues(balancesInPrimary, function(amount, currency) {
        var percentage = this.allocation[currency];
        var targetInPrimary = totalInPrimary * percentage / 100;
        return targetInPrimary * this.getRatio(currency, markets, primaryCurrency);
    }, this);
    return targetBalances;
};

CoinAllocator.prototype.getCurrentAllocation = function(primaryCurrency, markets, balances) {
    var balancesInPrimary = this.getBalancesInPrimary(primaryCurrency, markets, balances);
    var totalInPrimary = CoinAllocator.sumObject(balancesInPrimary);
    return _.mapValues(balancesInPrimary, function(amount) {
        return amount / totalInPrimary * 100;
    }, this);
};

CoinAllocator.prototype.getStatus = function(cb) {
    var self = this;
    async.series({ // because of nonces, cryptsy's API sometimes chokes if we execute a second request before the first one completes
        markets: function(cb) {
            self.exchange.getMarkets(self.currencies, cb);
        },
        balances: function(cb) {
            self.exchange.getBalances(self.currencies, cb);
        }
    }, function(err, results) {
        if (err) return cb(err);
        // todo: avoid duplicated work between these two functions
        var currentAllocation = self.getCurrentAllocation(self.primaryCurrency, results.markets, results.balances);
        var targetBalances = self.getTargetBalances(self.primaryCurrency, results.markets, results.balances);
        cb(null, {
            markets: results.markets,
            balances: results.balances,
            allocation: currentAllocation,
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
    var groupedTrades = _.groupBy(trades, function(trade) {
        if (trade.getFrom() == primaryCurrency) {
            return 'buys';
        } else if (trade.getTo() == primaryCurrency) {
            return 'sells';
        } else {
            // it's already been optimized and we're not going to use it here
            return 'swaps';
        }
    });
    var sells = groupedTrades.sells || [];
    var buys = groupedTrades.buys || [];

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

CoinAllocator.prototype.removeTradesBelowThreshold = function(tradeSet, threshold, status) {
    var balancesInPrimary = this.getBalancesInPrimary(this.primaryCurrency, status.markets, status.balances);
    var totalInPrimary = CoinAllocator.sumObject(balancesInPrimary);

    var trades = tradeSet.getTrades();

    var self = this;
    var filteredTrades = _.filter(trades, function(trade) {
        var amount = parseFloat(trade.getAmount());
        // todo: find market minimum trade amounts for each currency and use that instead
        if (amount < MINIMUM_BTC_SIZE) {
            return false;
        }
        return (self.getRatio(self.primaryCurrency, status.markets, trade.getFrom()) * amount / totalInPrimary) > threshold;
    });

    return new TradeSet(filteredTrades);
};

CoinAllocator.prototype.getSuggestedTrades = function(status) {
    var baselineSuggestedtrades = this.getBaselineSuggestedTrades(this.primaryCurrency, status.markets, status.balances, status.targetBalances);
    var optimizedTrades = this.optimizeTrades(this.primaryCurrency, status.markets, status.balances, status.targetBalances, this.threshold, baselineSuggestedtrades);

    return this.removeTradesBelowThreshold(optimizedTrades, this.threshold, status);
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
