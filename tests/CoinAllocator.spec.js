describe('CoinAllocator', function() {

    var CoinAllocator = require('../CoinAllocator.js');
    var TradeSet = CoinAllocator.TradeSet;
    var Trade = CoinAllocator.Trade;
    var allocation = {
        BTC: 50,
        LTC: 0,
        DOGE: 50
    };
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
            allocation: allocation,
            primaryCurrency: primaryCurrency,
            publicKey: "PUBLIC_KEY",
            privateKey: "PRIVATE_KEY",
            threshold: threshold
        });
        setCurrenciesBtcDoge();
    });

    describe('instance creation', function() {
        it("should throw if the allocation doesn't add up to 100%", function() {
            expect(function() {
                new CoinAllocator({
                    allocation: {
                        a: 50,
                        b: 60
                    }
                });
            }).toThrow();
            expect(function() {
                new CoinAllocator({
                    allocation: {
                        a: 30,
                        b: 30
                    }
                });
            }).toThrow();
        });
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

        it('should handle a 40-60 split', function() {
            coinAllocator = new CoinAllocator({
                allocation: {
                    BTC: 40,
                    DOGE: 60
                },
                primaryCurrency: primaryCurrency,
                publicKey: "PUBLIC_KEY",
                privateKey: "PRIVATE_KEY",
                threshold: threshold
            });
            expect(coinAllocator.getTargetBalances(primaryCurrency, markets, balances)).toEqual({
                BTC: 0.8,
                DOGE: 120
            });
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
                targetBalances: tb,
                allocation: {
                    BTC: 50,
                    DOGE: 50
                }
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

        it('should work on real-world data', function() {
            setCurrenciesBtcLtcDoge();

            markets.LTC.BTC.ratio = 0.02549999;
            markets.BTC.LTC.ratio = 1 / markets.LTC.BTC.ratio;

            markets.DOGE.BTC.ratio = 0.00000210;
            markets.BTC.DOGE.ratio = 1 / markets.DOGE.BTC.ratio;

            markets.DOGE.LTC.ratio = 0.00008338;
            markets.LTC.DOGE.ratio = 1 / markets.DOGE.LTC.ratio;

            balances = {
                BTC: 0.02074746,
                LTC: 0.38729028,
                DOGE: 8993.46645284
            };
            var targetBalances = {
                BTC: 0.0165032126060204,
                LTC: 0.6471850618772949,
                DOGE: 7858.672669533525
            };

            var trades = new TradeSet([
                new Trade({
                    "from": "DOGE",
                    "amount": "1134.79378331",
                    "to": "BTC"
                }),
                new Trade({
                    "from": "BTC",
                    "amount": "0.00662731",
                    "to": "LTC"
                })
            ]);

            var actual = coinAllocator.optimizeTrades(primaryCurrency, markets, balances, targetBalances, threshold, trades);


            var expected = [{
                "from": "DOGE",
                "amount": "1134.79378331",
                "to": "LTC"
            }, {
                "from": "BTC",
                "amount": "0.00424424",
                "to": "LTC"
            }];

            expect(actual.toJSON()).toEqual(expected);

        });
    });
});
