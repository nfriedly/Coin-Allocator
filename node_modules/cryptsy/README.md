node-cryptsy
============

Node module for Cryptsy trading platform.

Based on [Cryptsy reference implementation](https://www.cryptsy.com/pages/api)

## Install ##

```bash
$ npm install cryptsy
```

## Sample usage ##

### Create a Cryptsy object ###

```javascript
var Cryptsy = require('cryptsy');

var cryptsy = new Cryptsy('YOUR-KEY', 'YOUR-SECRET');
```

### Public Methods ###

Public methods do not require the use of an api key

* marketdata
* marketdatav2
* singlemarketdata
* orderdata
* singleorderdata

Examples:

```javascript
cryptsy.api('marketdata', null, function (err, data) {
    if (err) {
        throw err;
    } else {
        // do something with data
    }
});

cryptsy.api('singlemarketdata', { marketid: 26 }, function (err, data) {
    // ...
});
```

### Authenticated Methods ###

Authenticated methods require the use of an api key

* getinfo
* getmarkets
* mytransactions
* markettrades
* marketorders
* mytrades'
* allmytrades
* myorders
* depth
* allmyorders
* createorder
* cancelorder'
* cancelmarketorders
* cancelallorders
* calculatefees
* generatenewaddress

Examples:

```javascript
cryptsy.api('getinfo', null, function (err, data) {
    if (err) {
        throw err;
    } else {
        // do something with data
    }
});

cryptsy.api('getmarkets', null, function (err, data) {
    // ...
});

cryptsy.api('markettrades', { marketid: 26 }, function (err, data) {
    // ...
});

cryptsy.api('createorder', { marketid: 26, ordertype: 'Sell', quantity: 1000, price: 1000 }, function (err, data) {
    // ...
});

cryptsy.api('cancelorder', { orderid: 123456 }, function (err, data) {
    // ...
});

cryptsy.api('calculatefees', { ordertype: 'Buy', quantity: 1000, price: '0.005' }, function (err, data) {
    // ...
});
```

## API Documentation ##

[Cryptsy trading API](https://www.cryptsy.com/pages/api)

## License ##

MIT