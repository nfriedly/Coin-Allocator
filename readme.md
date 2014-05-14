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
    
3. Make sure you have some coins in your Cryptsy account. They don't currently support exchanging for USD, so you'll have to acquire them somewhere else.

4. [Turn on the API](https://www.cryptsy.com/users/settings) for your Cryptsy account and grab your public and private keys. 

5. Optional: Set your `CRYPTSY_PUBLIC_KEY` and `CRYPTSY_PRIVATE_KEY` environment variables to the appropriate values

6. Run `coin-allocator` with your desired allocation. For example, this would give a 60/40 BTC/LTC split: `coin-allocator --allocation.BTC 60 --allocation.LTC 40 --public-key a1b2c3... --private-key d1e2f3...` (Omit the keys if your already stored them in environment variables.) 

That's it! It should read your account balances and the current market rates and suggest a set of trades to re-balance your account. You will then have to type 'yes' for it to execute the suggested trades.

Tips:
* Set a currencies' allocation to 0 sell everything you have in that currency.
* Add the `--yes` argument to make it automatically execute the trades with out asking for confirmation.
* Set up a cron job to run this script every so often (maybe once per month), and then forget about it :)
* You can kill the program at any time by pressing `Control-c`. If there are trades open, it will attempt to cancel them.
* Coin-Allocator can also be `require()`'d by other Node.js code so you can build your own applications on top of it. I will document the API once it settles down a bit, and probably build a web site around the library eventually....
* Edit `heroku.sh` to have your desired allocation and then up an instance on [Heroku](https://heroku.com/) and then have the [Scheduler add-on](https://addons.heroku.com/scheduler) run `./heroku.sh` every so often.

<sub>\* Note: Links here are referral links. If you use my referral link for cryptsy.com, I will get a commission that is equivalent to about 0.000001% of your trade volume. (0.2% to 0.3% trade fee * 0.1% in Cryptsy Points * Cryptsy Point / BTC exchange rate - 0.00088743 at the time of writing.) This comes out of Cryptsy's fee and does not affect your account in any way.</sub>

Todo
----

* Better organize core code
* Make the exchange classes provide subclasses of the Trade & TradeSet objects, make them perform validation at creation time
* Make Trade Objects throw on creation if amount is below minimum exchange amount
* Better error for bogus / unsupported currencies
* Support arbitrary trade paths including through unrequested currencies if it provides a better value
* Add support for BTC-e (and other exchanges?)
* Calculate Amount lost to fees with a given trade set
* Calculate expected balances after a trade set is executed
* Figure out better names for executing/executed/orderProgress events - maybe order/progress/trade?
* Add some tests around gains computations
* grab market prices last to avoid working on outdated data
* run all trades in parallel except for situations where that could hit a negative balance
* add timeout option - kill trades not executed within timeout - default to 1 minute?




Notes for arbitrary trade paths:

1. for each currency, find its value in primary (no fees) 
2. find values for target allocation 
3. group currencies by above, below, and within threshold of target
4. for each above/below currency pair, find best trade paths.
5. compute trade ratio with fees.
6. compute ratio if source and destination were in then each converted to primary currency (no fees)
7. rank these by highest to lowest ratio
8. trade until source or dest reach target, then go onto next path. 

Step 1 details: get value: find best trade path, return ratio without fees. (memoize?)

Step 3 details: find best trade path: recursive function:  given, destination, list of letters path so far (starting with source), max length.
if last item = destination, return list.
if list length = max length, return false.
results set = for each currency that can be traded to from the last one in the list (excluding the one before it), call function with list + that cur
filter results set to remove falses
if empty, return false
sort by trade ratio (with fees)
return highest ratio trade path
top-level: if false, throw. otherwise return path
memoise.

todo:
- build a dependency graph for trades
- combine like trades as long as it won't cause a negative balance (a->b + a->b)
- combine equalizing trades (a->b + b->a)
- look for other optimizations
- begin executing trades in parallel, following graph
- figure out recovery path if trade dies on some random non-traded currency - maybe an "auto-sell all others" option?




