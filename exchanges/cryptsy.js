/** 
 * A quick wrapper around the existing Cryptsy npm module lib so that I have something to spy on in unit tests.
 * This should also allow for other exchanges to be easily swapped in.
 */

var _ = require('lodash');
var Cryptsy = require('cryptsy');

Cryptsy.prototype.getBalances = function(currencies, cb) {
    this.api('getinfo', null, function(err, info) {
        if (err) return cb(err);
        cb(null, _.pick(info.balances_available, currencies));
    });
};

Cryptsy.prototype.getPrices = function(currencies, cb) {
    this.api('marketdatav2', null, function(err, results) {
        if (err) return cb(err);
        // todo: trim down to only the appropriate currencies
        // todo: convert to a 2-d map of CurrencyA > CurrencyB > price
        cb(null, results.markets);
    });
};

module.exports = Cryptsy;
