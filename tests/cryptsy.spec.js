describe('Cryptsy API adapter', function() {

    var CoinAllocator = require('../CoinAllocator.js');
    var TradeSet = CoinAllocator.TradeSet;
    var Trade = CoinAllocator.Trade;
    var EventEmitter = require('events').EventEmitter;
    var Cryptsy = require('../exchanges/cryptsy.js');
    var marketsData = require('./data/cryptsy/getmarkets.json');
    var markets = marketsData['return'];
    var getInfoData = require('./data/cryptsy/getinfo.json');
    var calculateFeesBuy = require('./data/cryptsy/calculatefees-buy.json');
    var calculateFeesSell = require('./data/cryptsy/calculatefees-sell.json');
    var createOrder = require('./data/cryptsy/createorder.json');
    var myOrders = require('./data/cryptsy/myorders.json');
    var myTrades = require('./data/cryptsy/mytrades.json');

    var currencies = ['BTC', 'LTC', 'DOGE'];

    var cryptsy;

    beforeEach(function() {
        cryptsy = new Cryptsy('PUBLIC _KEY', 'PRIVATE_KEY');

        spyOn(cryptsy, 'api').andCallFake(function(method, data, cb) {
            if (typeof data != 'object') { // the first time that typeof null == object has ever been useful!
                throw new Error('cryptsy.api called with invalid data argument: ' + JSON.stringify([].slice.call(arguments)));
            }
            if (method == 'getmarkets') {
                cb(null, markets);
            } else if (method == 'calculatefees' && data && data.ordertype == 'Buy') {
                cb(null, calculateFeesBuy['return']);
            } else if (method == 'calculatefees' && data && data.ordertype == 'Sell') {
                cb(null, calculateFeesSell['return']);
            } else if (method == 'getinfo') {
                cb(null, getInfoData['return']);
            } else if (method == 'createorder') {
                setTimeout(cb.bind(null, null, createOrder), 0);
            } else if (method == 'myorders') {
                setTimeout(cb.bind(null, null, myOrders), 0);
            } else if (method == 'mytrades') {
                cb(null, myTrades);
            } else {
                throw new Error('cryptsy.api called with unexpected parameters: ' + JSON.stringify([].slice.call(arguments)));
            }

            // todo: add mytrades w/ sample data, get sample data for myorders
        });
    });

    describe('getBalances', function() {
        it('should strip out everything but the requested currencies', function() {
            var cb = jasmine.createSpy("callback");

            cryptsy.getBalances(currencies, cb);

            expect(cryptsy.api).toHaveBeenCalledWith('getinfo', null, jasmine.any(Function));
            expect(cryptsy.api.calls.length).toBe(1);

            expect(cb).toHaveBeenCalledWith(null, jasmine.any(Object));
            expect(cb.calls[0].args[1]).toEqual({
                BTC: 0.01489069,
                LTC: 0.38729028,
                DOGE: 5761.94327236
            });
        });
    });

    describe('getMarkets', function() {
        it('should return a map of coin->coin->{ratio,fee}', function() {
            var cb = jasmine.createSpy("callback");

            cryptsy.getMarkets(currencies, cb);

            expect(cryptsy.api.calls.length).toBe(3);
            expect(cryptsy.api).toHaveBeenCalledWith('getmarkets', null, jasmine.any(Function));
            expect(cryptsy.api).toHaveBeenCalledWith('calculatefees', jasmine.any(Object), jasmine.any(Function)); // x2

            expect(cb).toHaveBeenCalledWith(null, jasmine.any(Object));
            expect(cb.calls[0].args[0]).toBe(null);
            expect(cb.calls[0].args[1]).toEqual({
                DOGE: {
                    BTC: {
                        ratio: 0.00000213,
                        fee: 0.003
                    },
                    LTC: {
                        ratio: 0.0000851,
                        fee: 0.003
                    }
                },
                BTC: {
                    DOGE: {
                        ratio: 469483.56807511736,
                        fee: 0.002
                    },
                    LTC: {
                        ratio: 39.52569169960474,
                        fee: 0.002
                    }
                },
                LTC: {
                    BTC: {
                        ratio: 0.0253,
                        fee: 0.003
                    },
                    DOGE: {
                        ratio: 11750.881316098708,
                        fee: 0.002
                    }
                }
            });
        });
    });

    /**
convertTradeToOrder = function(markets, trade) {
    var to = trade.getTo();
    var from = trade.getFrom();
    var market = _.findWhere(markets, {
        label: util.format("%s/%s", to, from)
    });
    //console.log(util.format("%s/%s", to, from), market);
    if (market) {
        return {
            marketid: market.marketid,
            ordertype: 'Buy',
            // lasttradeprice is in the FROM currency, but quantity should be in the TO currency
            quantity: trade.getAmount() * market.lasttradeprice, // fees will make this take slightly more out of the FROM account
            price: market.lasttradeprice
        };
    } else {
        market = _.findWhere(markets, {
            label: util.format("%s/%s", from, to)
        });

        //console.log(util.format("%s/%s", from, to), market);
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
};*/
    describe('convertTradeToOrder', function() {
        it('should convert a BTC->LTC trade to a Buy order on the appropriate market', function() {
            var trade = new Trade({
                from: 'BTC',
                to: 'LTC',
                amount: 1 // at price 0.02530000
            });

            var actual = cryptsy.convertTradeToOrder(markets, trade);

            var expected = {
                marketid: '3',
                ordertype: 'Buy',
                quantity: '39.52569170',
                price: '0.02530000'
            };

            expect(actual).toEqual(expected);
        });

        it('should convert a LTC->BTC trade to a Sell order on the appropriate market', function() {
            var trade = new Trade({
                from: 'LTC',
                to: 'BTC',
                amount: 1
            });

            var actual = cryptsy.convertTradeToOrder(markets, trade);

            var expected = {
                marketid: '3',
                ordertype: 'Sell',
                quantity: '1.00000000',
                price: '0.02530000'
            };

            expect(actual).toEqual(expected);
        });

        it('should get the ratio correct for Buy orders', function() {
            // this is a regression test since I did my math wrong on my initial unit test. (The difference is that a regression test uses real-world data while a unit test may use simple/fake data.)
            var markets = [{
                "marketid": "155",
                "label": "DRK/BTC",
                "primary_currency_code": "DRK",
                "primary_currency_name": "DarkCoin",
                "secondary_currency_code": "BTC",
                "secondary_currency_name": "BitCoin",
                "current_volume": "216329.96292512",
                "current_volume_btc": "2944.25728531",
                "current_volume_usd": "1323090.33887250",
                "last_trade": "0.01300001",
                "high_trade": "0.01581886",
                "low_trade": "0.01051000",
                "created": "2014-02-23 23:55:09"
            }];
            var trade = new Trade({
                "from": "BTC",
                "amount": "0.04010938",
                "to": "DRK"
            });

            var actual = cryptsy.convertTradeToOrder(markets, trade);

            expect(actual).toEqual({
                "marketid": "155",
                "ordertype": "Buy",
                "quantity": "3.08533455",
                "price": "0.01300001"
            });
        });

        describe('executeTrades', function() {
            it('should gather data and call the executeTrade method for each trade', function() {
                var cb = jasmine.createSpy("done callback");
                var errCb = jasmine.createSpy("error callback");
                var progressCb = jasmine.createSpy("progress callback");

                var orderProgress = new EventEmitter();

                spyOn(cryptsy, 'executeTrade').andReturn(orderProgress);

                var trade = new Trade({
                    from: 'BTC',
                    to: 'LTC',
                    amount: 1
                });
                var trades = new TradeSet([trade]);

                var progress = cryptsy.executeTrades(trades);

                progress.on('orderProgress', progressCb);
                progress.on('error', errCb);
                progress.on('done', cb);


                orderProgress.emit('orderProgress', 1, 2);

                expect(errCb).not.toHaveBeenCalled();
                expect(progressCb).toHaveBeenCalledWith(1, 2);
                expect(cb).not.toHaveBeenCalled();

                orderProgress.emit('executed');

                expect(errCb).not.toHaveBeenCalled();
                expect(cryptsy.executeTrade).toHaveBeenCalledWith(markets, trade);
                expect(cb).toHaveBeenCalled();

            });

        });

        describe('executeTrade', function() {

            var trade, progress, order, executingCb, progressCb, executedCb, errorCb;

            beforeEach(function() {
                trade = new Trade({
                    from: 'BTC',
                    to: 'LTC',
                    amount: 1
                });
                executingCb = jasmine.createSpy('executing callback');
                progressCb = jasmine.createSpy('progress callback');
                executedCb = jasmine.createSpy('executed callback');
                errorCb = jasmine.createSpy('error callback');

                order = {
                    marketid: '3',
                    ordertype: 'Buy',
                    quantity: '0.02530000',
                    price: '0.02530000'
                };
                spyOn(cryptsy, 'convertTradeToOrder').andReturn(order);

                jasmine.Clock.useMock();
            });

            afterEach(function() {
                // without this, it will let the callbacks fire *after* the mock has been uninstalled - and make actual requests to the cryptsy API
                jasmine.Clock.tick(50);
            });

            it('should call the cryptsy API with the trade and return an EventEmitter', function() {

                progress = cryptsy.executeTrade(markets, trade);

                expect(cryptsy.api).toHaveBeenCalledWith('createorder', order, jasmine.any(Function));

                expect(progress instanceof EventEmitter).toBe(true);
            });

            it('should emit an executing event as soon as the order is placed', function() {
                progress = cryptsy.executeTrade(markets, trade);
                progress.on('executing', executingCb);
                progress.on('error', errorCb);

                expect(cryptsy.api).toHaveBeenCalledWith('createorder', order, jasmine.any(Function));

                jasmine.Clock.tick(1);

                expect(errorCb).not.toHaveBeenCalled();
                expect(executingCb).toHaveBeenCalledWith(trade, createOrder.orderid, order);

            });

            it('should emit orderProgress events as the order is completed and an executed event afterwards', function() {
                var openOrder = {
                    quantity: '0.02530000', // this is the amount left to buy/sell, it decreases until it reaches 0 and it's no longer an open order
                    orig_quantity: '0.02530000'
                };
                spyOn(cryptsy, 'getOpenOrder').andCallFake(function(marketid, orderid, cb) {
                    cb(null, openOrder);
                });
                var completedOrder = myTrades['return'][0];
                spyOn(cryptsy, 'getCompletedOrder').andCallFake(function(marketid, orderid, cb) {
                    cb(null, completedOrder);
                });

                progress = cryptsy.executeTrade(markets, trade);
                progress.on('orderProgress', progressCb);
                progress.on('executed', executedCb);
                progress.on('error', errorCb);


                jasmine.Clock.tick(50);

                expect(errorCb).not.toHaveBeenCalled();
                expect(cryptsy.getOpenOrder.calls.length).toBe(1);
                expect(cryptsy.getOpenOrder).toHaveBeenCalledWith('3', createOrder.orderid, jasmine.any(Function));
                expect(progressCb).toHaveBeenCalledWith('0.00000000', '0.02530000');
                expect(cryptsy.getCompletedOrder).not.toHaveBeenCalled();
                expect(executedCb).not.toHaveBeenCalled();

                openOrder = null;
                jasmine.Clock.tick(101);

                expect(errorCb).not.toHaveBeenCalled();
                expect(cryptsy.getOpenOrder.calls.length).toBe(2);
                expect(progressCb.calls.length).toBe(2);
                expect(progressCb).toHaveBeenCalledWith('0.02530000', '0.02530000');
                expect(cryptsy.getCompletedOrder).toHaveBeenCalledWith('3', createOrder.orderid, jasmine.any(Function));
                expect(executedCb).toHaveBeenCalledWith(completedOrder.tradeid);
            });
        });
    });
});
