# harvest-zendesk-sync Lambda Task

An AWS Lambda function to sync Clients and Projects from Harvest into tagger fields in ZenDesk.

## Requirements

* Lambda uses node v0.10.36, use `nvm` to install this version and test your code against it

## Setup

1. Clone repo
2. `cp config.env.sample config.env.production`
3. Fill in production config options
4. `ls -s config.env.production .env`
5. `npm run dev`

## Deploy to Lambda

1. `npm run upload`
