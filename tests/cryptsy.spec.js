describe('Cryptsy API adapter', function() {

    var Cryptsy = require('../exchanges/cryptsy.js');
    var marketsData = require('./data/cryptsy/getmarkets.json');
    var markets = marketsData['return'];
    var getInfoData = require('./data/cryptsy/getinfo.json');
    var calculateFeesBuy = require('./data/cryptsy/calculatefees-buy.json');
    var calculateFeesSell = require('./data/cryptsy/calculatefees-sell.json');
    var createOrder = require('./data/cryptsy/createorder.json');

    var currencies = ['BTC', 'LTC', 'DOGE'];

    var cryptsy;

    beforeEach(function() {
        cryptsy = new Cryptsy('PUBLIC _KEY', 'PRIVATE_KEY');

        spyOn(cryptsy, 'api').andCallFake(function(method, data, cb) {
            if (method == 'getmarkets') {
                cb(null, markets);
            } else if (method == 'calculatefees' && data && data.ordertype == 'Buy') {
                cb(null, calculateFeesBuy['return']);
            } else if (method == 'calculatefees' && data && data.ordertype == 'Sell') {
                cb(null, calculateFeesSell['return']);
            } else if (method == 'getinfo') {
                cb(null, getInfoData['return']);
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

            expect(errCb).not.toHaveBeenCalled();
            expect(progressCb).toHaveBeenCalledWith(1, 2);
            expect(cb).not.toHaveBeenCalled();

            orderProgress.emit('executed');

            expect(errCb).not.toHaveBeenCalled();
            expect(cryptsy.executeTrade).toHaveBeenCalledWith(markets, trade);
            expect(cb).toHaveBeenCalled();

        });

    });

    xdescribe('executeTrade', function() {
        it('should call the cryptsy API with the trade and continue calling until the order is complete', function() {


        });
    });
});
