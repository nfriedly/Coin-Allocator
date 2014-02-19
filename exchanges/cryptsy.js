/** 
 * Cryptsy API
 *
 * A quick wrapper around the existing Cryptsy npm module lib to generalize the source data.
 * This should  allow for other exchanges to be easily swapped in.
 *
 * https://www.cryptsy.com/pages/api
 */

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var async = require('async');
var Cryptsy = require('cryptsy');

Cryptsy.prototype.getBalances = function(currencies, cb) {
    this._getInfo(function(err, info) {
        if (err) return cb(err);
        this._info = info;
        cb(null, _.chain(info.balances_available).pick(currencies).mapValues(function(strBal) {
            return +strBal; // convert the balance from a string to a number.
        }).value());
    });
};

Cryptsy.prototype.getMarkets = function(currencies, cb) {
    // todo: see if caching the marketids and then just fetching individual market pricesp brings better performance
    var cryptsy = this;
    async.parallel({
        markets: function(cb) {
            cryptsy._getMarkets(cb);
        },
        buyFee: function(cb) {
            cryptsy._getFees({
                ordertype: 'Buy',
                quantity: 1,
                price: 1
            }, cb);
        },
        sellFee: function(cb) {
            cryptsy._getFees({
                ordertype: 'Sell',
                quantity: 1,
                price: 1
            }, cb);
        }
    }, function(err, results) {
        if (err) return cb(err);
        var markets = {};
        _.each(results.markets, function(market) {
            // todo: see if turning currencies into a map makes any appreciable performance difference here
            if (_.contains(currencies, market.primarycode) && _.contains(currencies, market.secondarycode)) {
                markets[market.primarycode] = markets[market.primarycode] || {};
                markets[market.primarycode][market.secondarycode] = {
                    // for example, in the DOGE/BTC market, primary = DOGE, secondary = BTC, lasttradeprice = 0.00000262 
                    // this means that 1 DOGE buys you 0.00000262 BTC
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

Cryptsy.prototype.executeTrades = function(tradeSet) {
    var cryptsy = this;
    var tradeSetProgress = new EventEmitter();
    this._getMarkets(function(err, markets) {
        if (err) return tradeSetProgress.emit('error', err);
        async.eachSeries(tradeSet.getTrades(), function(trade, cb) {
                var tradeProgress = cryptsy.executeTrade(markets, trade);
                // bubble these events
                ['executing', 'orderProgress', 'executed', 'error'].forEach(function(event) {
                    tradeProgress.on(event, tradeSetProgress.emit.bind(tradeSetProgress, event));
                });
                tradeProgress.on('executed', cb.bind(null, null));
                tradeProgress.on('error', cb);
            },
            function(err) {
                if (err) {
                    tradeSetProgress.emit('error', err);
                }
                tradeSetProgress.emit('done');
            }
        );
    });
    return tradeSetProgress;
};

Cryptsy.prototype.executeTrade = function(markets, trade) {
    var cryptsy = this;
    var tradeProgress = new EventEmitter();
    var order = cryptsy.convertTradeToOrder(markets, trade);
    cryptsy.api('createorder', order, function(err, data) {
        if (err) return tradeProgress.emit('error', err);
        var orderId = data && data.orderid;
        tradeProgress.emit('executing', trade, order, orderId);

        function checkStatus() {
            cryptsy.getOrder(function(err, order) {
                // todo: consider allowing one or two retries here since this is purely informational and we now have outstanding orders...
                if (err) return tradeProgress.emit('error', err);
                var completed = order.orig_quantity - order.quantity;
                tradeProgress.emit('orderProgress', completed, order.orig_quantity);
                if (!order.quantity) {
                    tradeProgress.emit('executed', trade, order, orderId);
                } else {
                    // give it a short pause, then try again
                    setTimeout(checkStatus, 500);
                }
            });
        }
        setTimeout(checkStatus, 100);
    });
    return tradeProgress;
};

Cryptsy.prototype.getOrder = function(orderId, cb) {
    this.api('myorders', function(err, data) {
        if (err) return cb(err);
        cb(null, _.find(data, {
            orderid: orderId
        }));
    });
};

Cryptsy.prototype.cancelAllOrders = function(cb) {
    this.api('cancelallorders', cb);
};


Cryptsy.prototype._getInfo = function(cb) {
    // memoize looses the context, so we'll lock it in at the first call
    this._getInfo = async.memoize(this.api.bind(this, 'getinfo', null));
    this._getInfo(cb);
};

Cryptsy.prototype._getFees = function(order, cb) {
    // memoize looses the context, so we'll lock it in at the first call
    // the default hasher checks only the first param, but we need to see the data for the 'calculatefees' method
    var memoizeHasher = JSON.stringify.bind(JSON);
    this._getFees = async.memoize(this.api.bind(this, 'calculatefees'), memoizeHasher);
    this._getFees(order, cb);
};

Cryptsy.prototype._getMarkets = function(cb) {
    var cryptsy = this;
    this._getMarkets = async.memoize(function(cb) {
        cryptsy.api('marketdatav2', null, function(err, marketdata) {
            cb(err, marketdata && marketdata.markets);
        });
    });
    this._getMarkets(cb);
};

Cryptsy.prototype.convertTradeToOrder = function(markets, trade) {
    var to = trade.getTo();
    var from = trade.getFrom();
    var market = markets[util.format("%s/%s", to, from)];
    if (market) {
        return {
            marketid: market.marketid,
            ordertype: 'Buy',
            // lasttradeprice is in the FROM currency, but quantity should be in the TO currency
            quantity: trade.getAmount() * market.lasttradeprice, // fees will make this take slightly more out of the FROM account
            price: market.lasttradeprice
        };
    } else {
        market = markets[util.format("%s/%s", from, to)];
        if (!market) {
            throw new Error("Impossible trade, no market available: " + trade.toString());
        }
        return {
            marketid: market.marketid,
            ordertype: 'Sell',
            quantity: trade.getAmount(), // fees will make this put slightly less into the TO account
            price: market.lasttradeprice
        };
    }
};

/*
Cryptsy.prototype.validateTradeSet = function(tradeSet, cb) {
    var cryptsy = this;
    cryptsy._getInfo(function(infoErr, info) {
        cryptsy._getMarkets(function(marketsErr, markets) {
            if (infoErr || marketsErr) {
                return cb(infoErr || marketsErr);
            }
            var curBalances = _.cloneDeep(info.balances_available);
            var trades = 
            var orders = _.map(tradeSet.getTrades(), _.bind(cryptsy.convertTradeToOrder, cryptsy, markets));
            var maxSimultaneousApiCalls = 4;
            async.mapLimit(orders, maxSimultaneousApiCalls, _.bind(cryptsy._getFees, cryptsy), function(err, fees) {
                if (err) return cb(err);
                
                if (fees.length != tradeSet.getTrades().length) {
                    return cb(new Error(util.format("Unable to validate TradeSet, incorrect number of fees returned:\n\nTradeSet:\n%s\n\nFees:\n%s", tradeSet.toString(), JSON.stringify(fees))));
                }
                
                orders.forEach(function(order, index) {
                    var fee = fees[index];
                    if (order.orderType == 'Buy') {
                        
                    }
                });
            });
        });
    });
};
*/

module.exports = Cryptsy;
