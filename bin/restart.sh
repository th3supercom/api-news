#!/bin/bash

set -x
kill -9 $(ps aux | grep "Headless-Chrome" | grep -v grep | awk '{print $2}')
kill -9 $(ps aux | grep "node_modules" | grep -v grep | awk '{print $2}')
root=/home/services/puppeteer
nohup node $root/src/server.js $root/data/Headless-Chrome > $root/logs/nohup.log 2>&1 &
