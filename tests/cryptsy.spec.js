describe('Cryptsy API adapter', function() {

    var Cryptsy = require('../exchanges/cryptsy.js');
    var marketDataV2 = require('./data/cryptsy/marketdatav2.json');
    var markets = marketDataV2['return'].markets;
    var getInfoData = require('./data/cryptsy/getinfo.json');
    var calculateFeesBuy = require('./data/cryptsy/calculatefees-buy.json');
    var calculateFeesSell = require('./data/cryptsy/calculatefees-sell.json');
    var createOrder = require('./data/cryptsy/createorder.json');

    var currencies = ['BTC', 'LTC', 'DOGE'];

    var cryptsy;

    beforeEach(function() {
        cryptsy = new Cryptsy('PUBLIC _KEY', 'PRIVATE_KEY');

        spyOn(cryptsy, 'api').andCallFake(function(method, data, cb) {
            if (method == 'marketdatav2') {
                cb(null, marketDataV2['return']);
            } else if (method == 'calculatefees' && data && data.ordertype == 'Buy') {
                cb(null, calculateFeesBuy['return']);
            } else if (method == 'calculatefees' && data && data.ordertype == 'Sell') {
                cb(null, calculateFeesSell['return']);
            } else if (method == 'createorder') {
                cb(null, createOrder.orderid);
            } else {
                throw new Error('cryptsy.api called with unexpected parameters: ' + JSON.stringify([].slice.call(arguments)));
            }
        });
    });

    describe('getBalances', function() {
        it('should strip out everything but the requested currencies', function() {
            var cb = jasmine.createSpy("callback");
            spyOn(cryptsy, 'api').andCallFake(function(method, data, cb) {
                cb(null, getInfoData['return']);
            });

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
            expect(cryptsy.api).toHaveBeenCalledWith('marketdatav2', null, jasmine.any(Function));
            expect(cryptsy.api).toHaveBeenCalledWith('calculatefees', jasmine.any(Object), jasmine.any(Function)); // x2

            expect(cb).toHaveBeenCalledWith(null, jasmine.any(Object));
            expect(cb.calls[0].args[0]).toBe(null);
            expect(cb.calls[0].args[1]).toEqual({
                DOGE: {
                    LTC: {
                        ratio: 0.00010250,
                        fee: 0.00300000
                    },
                    BTC: {
                        ratio: 0.00000262,
                        fee: 0.00300000
                    }
                },
                LTC: {
                    DOGE: {
                        ratio: 9756.09756097561,
                        fee: 0.00200000
                    },
                    BTC: {
                        ratio: 0.02600000,
                        fee: 0.00300000
                    }
                },
                BTC: {
                    DOGE: {
                        ratio: 381679.3893129771,
                        fee: 0.00200000
                    },
                    LTC: {
                        ratio: 38.46153846153846,
                        fee: 0.00200000
                    }
                }
            });
        });
    });

    describe('executeTrades', function() {
        var CoinAllocator = require('../CoinAllocator.js');
        var TradeSet = CoinAllocator.TradeSet;
        var Trade = CoinAllocator.Trade;
        var EventEmitter = require('events').EventEmitter;


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

            expect(progressCb).toHaveBeenCalledWith(1, 2);
            expect(cb).not.toHaveBeenCalled();
            expect(errCb).not.toHaveBeenCalled();

            orderProgress.emit('done');
            expect(cryptsy.executeTrade).toHaveBeenCalledWith(markets, trade);
            expect(cb).toHaveBeenCalled();
            expect(errCb).not.toHaveBeenCalled();

        });

    });

    describe('executeTrade', function() {
        it('should call the cryptsy API with the trade and continue calling until the order is complete', function() {


        });
    });
});
