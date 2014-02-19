describe('CoinAllocator', function() {

    var CoinAllocator = require('../CoinAllocator.js');
    var TradeSet = CoinAllocator.TradeSet;
    var Trade = CoinAllocator.Trade;
    var currencies = ['BTC', 'LTC', 'DOGE'];
    var primaryCurrency = 'BTC';
    var threshold = 1;
    var coinAllocator;
    var markets;
    var balances;

    function setCurrenciesBtcDoge() {
        markets = {
            BTC: {
                DOGE: {
                    ratio: 100,
                    fee: 0.002
                }
            },
            DOGE: {
                BTC: {
                    ratio: 0.01,
                    fee: 0.003
                }
            }
        };
        balances = {
            BTC: 1,
            DOGE: 100
        };
    }

    function setCurrenciesBtcLtcDoge() {
        markets.LTC = {
            BTC: {
                ratio: 0.1,
                fee: 0.003
            },
            DOGE: {
                ratio: 10,
                fee: 0.002
            }
        };
        markets.BTC.LTC = {
            ratio: 10,
            fee: 0.002
        };
        markets.DOGE.LTC = {
            ratio: 0.1,
            fee: 0.003
        };
        balances.LTC = 10;
    }

    beforeEach(function() {
        coinAllocator = new CoinAllocator({
            currencies: currencies,
            primaryCurrency: primaryCurrency,
            publicKey: "PUBLIC_KEY",
            privateKey: "PRIVATE_KEY",
            threshold: threshold
        });
        setCurrenciesBtcDoge();
    });

    describe('getRatio', function() {
        it('should correctly converte between BTC and DOGE', function() {
            expect(coinAllocator.getRatio('BTC', markets, 'DOGE')).toBe(0.01);
            expect(coinAllocator.getRatio('DOGE', markets, 'BTC')).toBe(100);
        });
    });

    describe('getBalancesInPrimary', function() {
        it('should convert balances to their primary currency', function() {
            balances = {
                BTC: 2,
                DOGE: 3
            };
            expect(coinAllocator.getBalancesInPrimary('BTC', markets, balances)).toEqual({
                BTC: 2,
                DOGE: 0.03
            });
        });
    });

    describe('getTargetBalances', function() {
        it('should suggest appropriate changes', function() {
            var actual = coinAllocator.getTargetBalances(primaryCurrency, markets, {
                BTC: 2,
                DOGE: 0
            });
            expect(actual).toEqual({
                BTC: 1,
                DOGE: 100
            });
        });
        it('should suggest no changes when everything is equal', function() {
            balances.DOGE = balances.BTC * markets.BTC.DOGE.ratio;
            expect(coinAllocator.getTargetBalances(primaryCurrency, markets, balances)).toEqual(balances);
        });
    });

    describe('getStatus', function() {

        it('should wire everything up correctly', function() {
            var cb = jasmine.createSpy('callback');
            spyOn(coinAllocator.exchange, 'getMarkets').andCallFake(function(curriencies, cb) {
                cb(null, markets);
            });
            spyOn(coinAllocator.exchange, 'getBalances').andCallFake(function(curriencies, cb) {
                cb(null, balances);
            });
            var tb = {};
            spyOn(coinAllocator, 'getTargetBalances').andReturn(tb);

            coinAllocator.getStatus(cb);

            expect(coinAllocator.exchange.getMarkets).toHaveBeenCalledWith(currencies, jasmine.any(Function));
            expect(coinAllocator.exchange.getBalances).toHaveBeenCalledWith(currencies, jasmine.any(Function));

            expect(coinAllocator.getTargetBalances).toHaveBeenCalledWith(primaryCurrency, markets, balances);

            expect(cb).toHaveBeenCalledWith(null, jasmine.any(Object));
            expect(cb.calls[0].args[1]).toEqual({
                markets: markets,
                balances: balances,
                targetBalances: tb
            });

        });
    });


    describe('getBaselineSuggestedTrades', function() {

        it('should suggest no trades when everything is equal', function() {
            var actual = coinAllocator.getBaselineSuggestedTrades(primaryCurrency, markets, balances, balances);
            expect(actual.toJSON()).toEqual([]);
        });

        it('should suggest sensible trades to and from the primary currency', function() {
            setCurrenciesBtcLtcDoge();
            balances = {
                BTC: 0,
                LTC: 30,
                DOGE: 0
            };
            var targetBalances = {
                BTC: 1,
                LTC: 10,
                DOGE: 100
            };
            var actual = coinAllocator.getBaselineSuggestedTrades(primaryCurrency, markets, balances, targetBalances);
            var expected = [{
                amount: '20.00000000',
                from: 'LTC',
                to: 'BTC'
            }, {
                amount: '1.00000000',
                from: 'BTC',
                to: 'DOGE'
            }];
            expect(actual.toJSON()).toEqual(expected);

        });
    });

    describe('optimizeTrades', function() {
        it('should combine equal trades to and from primary', function() {
            setCurrenciesBtcLtcDoge();

            var targetBalances = {
                BTC: 1,
                LTC: 10,
                DOGE: 100
            };
            var balances = {
                BTC: 1,
                LTC: 20,
                DOGE: 0
            };
            var trades = new TradeSet([new Trade({
                amount: 10,
                from: 'LTC',
                to: 'BTC'
            }), new Trade({
                amount: 1,
                from: 'BTC',
                to: 'DOGE'
            })]);

            var actual = coinAllocator.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, trades);

            var expected = [{
                amount: '10.00000000',
                from: 'LTC',
                to: 'DOGE'
            }];

            expect(actual.toJSON()).toEqual(expected);

        });


        it('should split a large sell and a small buy to avoid the primary market for the small buy', function() {
            setCurrenciesBtcLtcDoge();

            var targetBalances = {
                BTC: 1,
                LTC: 10,
                DOGE: 100
            };
            var trades = new TradeSet([new Trade({
                amount: 20,
                from: 'LTC',
                to: 'BTC'
            }), new Trade({
                amount: 1,
                from: 'BTC',
                to: 'DOGE'
            })]);

            var actual = coinAllocator.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, trades);

            var expected = [{
                amount: '10.00000000',
                from: 'LTC',
                to: 'BTC'
            }, {
                amount: '10.00000000',
                from: 'LTC',
                to: 'DOGE'
            }];

            expect(actual.toJSON()).toEqual(expected);

        });


        it('should split a small sell and a large buy to avoid the primary for the small sell', function() {
            setCurrenciesBtcLtcDoge();

            var targetBalances = {
                BTC: 1.9,
                LTC: 11,
                DOGE: 0
            };
            var trades = new TradeSet([new Trade({
                amount: 1,
                from: 'LTC',
                to: 'BTC'
            }), new Trade({
                amount: 1,
                from: 'BTC',
                to: 'DOGE'
            })]);

            var actual = coinAllocator.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, trades);

            var expected = [{
                amount: '1.00000000',
                from: 'LTC',
                to: 'DOGE'
            }, {
                amount: '0.90000000',
                from: 'BTC',
                to: 'DOGE'
            }];

            expect(actual.toJSON()).toEqual(expected);

        });

        it("should continue to go through the primary currency if there is no intermediate exchange available", function() {
            setCurrenciesBtcLtcDoge();

            delete markets.LTC.DOGE;
            delete markets.DOGE.LTC;

            var targetBalances = {
                BTC: 1.9,
                LTC: 11,
                DOGE: 0
            };
            var trades = new TradeSet([new Trade({
                amount: 1,
                from: 'LTC',
                to: 'BTC'
            }), new Trade({
                amount: 1,
                from: 'BTC',
                to: 'DOGE'
            })]);

            var actual = coinAllocator.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, trades);

            var expected = [{
                amount: '1.00000000',
                from: 'LTC',
                to: 'BTC'
            }, {
                amount: '1.00000000',
                from: 'BTC',
                to: 'DOGE'
            }];

            expect(actual.toJSON()).toEqual(expected);
        });

        it("should find multiple direct improvements in a large trade set", function() {
            markets = {
                BTC: {
                    A: {
                        ratio: 1
                    },
                    B: {
                        ratio: 1
                    },
                    C: {
                        ratio: 1
                    },
                    D: {
                        ratio: 1
                    }
                },
                A: {
                    BTC: {
                        ratio: 1
                    },
                    B: {
                        ratio: 1
                    }
                },
                B: {
                    BTC: {
                        ratio: 1
                    },
                    A: {
                        ratio: 1
                    }
                },
                C: {
                    BTC: {
                        ratio: 1
                    },
                    D: {
                        ratio: 1
                    }
                },
                D: {
                    BTC: {
                        ratio: 1
                    },
                    C: {
                        ratio: 1
                    }
                }
            };
            balances = {
                BTC: 1,
                A: 2,
                B: 0,
                C: 2,
                D: 0
            };
            var targetBalances = {
                BTC: 1,
                A: 1,
                B: 1,
                C: 1,
                D: 1
            };
            var trades = new TradeSet([new Trade({
                from: 'A',
                amount: 1,
                to: 'BTC'
            }), new Trade({
                from: 'BTC',
                amount: 1,
                to: 'B'
            }), new Trade({
                from: 'C',
                amount: 1,
                to: 'BTC'
            }), new Trade({
                from: 'BTC',
                amount: 1,
                to: 'D'
            })]);


            var actual = coinAllocator.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, trades);


            var expected = [{
                from: 'A',
                amount: '1.00000000',
                to: 'B'
            }, {
                from: 'C',
                amount: '1.00000000',
                to: 'D'
            }];

            expect(actual.toJSON()).toEqual(expected);
        });
    });
});
