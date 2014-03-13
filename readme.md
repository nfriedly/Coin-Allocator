Coin Allocator
==============

[![Build Status](https://travis-ci.org/nfriedly/Coin-Allocator.png?branch=master)](https://travis-ci.org/nfriedly/Coin-Allocator)

Taking the lessons from [The Intelligent Asset Allocator](http://www.amazon.com/gp/product/0071362363/ref=as_li_ss_il?ie=UTF8&camp=1789&creative=390957&creativeASIN=0071362363&linkCode=as2&tag=nfriedly-20) and applying them to Bitcoin and friends via [Cryptsy](https://www.cryptsy.com/users/register?refid=154285).

Takes your target allocation and your current balances and suggests a set of trades to rebalance while optimizing for lowest fees and number of trades. Then, optionally, executes those trades for you.

WARNING
------------

This software is in alpha stage. It is incomplete and almost guaranteed to have bugs. Using it may cause you to loose money or experience other issues. You have been warned.

Setup & Usage
-------------

1. To run your own copy, first download and install [Node.js](http://nodejs.org/), then install Coin Allocator with this command:
    `npm install -g coin-allocator`

2. If you don't already have a Cryptsy account, please use this link* to sign up: https://www.cryptsy.com/users/register?refid=154285

    Optional: If already signed up for Cryptsy but would still like to give me credit*, you may enter the following trade key in the "I was referred by" section of the [dashboard](https://www.cryptsy.com/users/dashboard): `93c94927ce29eebbb9f6aa6db5ca3fb6f164e97e`

3. [Turn on the API](https://www.cryptsy.com/users/settings) for your Cryptsy account and grab your public and private keys. 

4. Optional: Set your `CRYPTSY_PUBLIC_KEY` and `CRYPTSY_PRIVATE_KEY` environment variables to the appropriate values

5. Run `coin-allocator` with your desired allocation. For example, this would give a 60/40 BTC/LTC split: `coin-allocator --allocation.BTC 60 --allocation.LTC 40 --public-key a1b2c3... --private-key d1e2f3...` (Omit the keys if your already stored them in environment variables.) 

That's it! It should read your account balances and the current market rates and suggest a set of trades to re-balance your account. You will then have to type 'yes' for it to execute the suggested trades.

Tips:
* Set a currencies' allocation to 0 sell everything you have in that currency.
* Add the `--yes` argument to make it automatically execute the trades with out asking for confirmation.
* Set up a cron job to run this script every so often (maybe once per month), and then forget about it :)
* You can kill the program at any time by pressing `Control-c`. If there are trades open, it will attempt to cancel them.
* Coin-Allocator can also be `require()`'d by other Node.js code so you can build your own applications on top of it. I will document the API once it settles down a bit, and probably build a web site around the library eventually....

<sub>\* Note: Links here are referral links. If you use my referral link for cryptsy.com, I will get a commission that is equivalent to about 0.000001% of your trade volume. (0.2% to 0.3% trade fee * 0.1% in Cryptsy Points * Cryptsy Point / BTC exchange rate - 0.00088743 at the time of writing.) This comes out of Cryptsy's fee and does not affect your account in any way.</sub>

Todo
----

* Support minimum threshold in percentage points off of target
* Make the exchange provide subclasses of the Trade & TradeSet objects, make them perform validation at creation time
* Figure out minimum exchange amounts (scrape? tiny fake transactions?)
* Make Trade Objects throw on creation if amount is below minimum exchange amount
* Set up live instance to rebalance my account
* Better error for bogus / unsupported currencies
* Support A->B->C paths even when B is not a requested currency
* Add support for BTC-e (and other exchanges?)
* Calculate Amount lost to fees with a given trade set
* Calculate expected balances after a trade set is executed
* Split optimizer (& tests) into separate file
* Figure out better names for executing/executed/orderProgress events - maybe order/progress/trade?
* Add some tests around gains computations
