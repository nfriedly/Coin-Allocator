describe('Cryptsy API adapter', function() {
    var Cryptsy = require('../exchanges/cryptsy.js');
    var marketDataV2 = require('./data/cryptsy-marketdatav2.json');
    var getInfoData = require('./data/cryptsy-getinfo.json');

    var cryptsy;

    beforeEach(function() {
        cryptsy = new Cryptsy('PUBLIC _KEY', 'PRIVATE_KEY');
    });

    describe('getBalances', function() {
        it('should strip out everything but the requested currencies', function() {
            var cb = jasmine.createSpy();
            spyOn(cryptsy, 'api').andCallFake(function(method, data, cb) {
                cb(null, getInfoData['return']);
            });

            cryptsy.getBalances(['BTC', 'LTC', 'DOGE'], cb);

            expect(cryptsy.api).toHaveBeenCalledWith('getinfo', null, jasmine.any(Function));
            expect(cryptsy.api.calls.length).toBe(1);

            expect(cb).toHaveBeenCalledWith(null, jasmine.any(Object));
            expect(cb.calls[0].args[1]).toEqual({
                BTC: '0.01489069',
                LTC: '0.38729028',
                DOGE: '5761.94327236'
            });
        });
    });
});
