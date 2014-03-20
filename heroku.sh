# run my target allocation 
# note the --yes parameter is required to have it run as a scheduled task
# the --no-compute-gains param is optional but recommended because speeds things up.
# my keys are stored in the CRYPTSY_PUBKLIC_KEY and CRYPTSY_PRIVATE_KEY on heroku (run `heroku config:add 'KEY=value'`)

node cli.js --allocation.BTC 50 --allocation.LTC 20 --allocation.DOGE 25 --allocation.XPM 5 --threshold 3 --no-compute-gains --yes