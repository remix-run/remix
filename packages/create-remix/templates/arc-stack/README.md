# Remix Architect (AWS) Stack

## Architect Setup

When deploying to AWS Lambda with Architect, you'll need:

- Architect (`arc`) CLI
- AWS SDK

Architect recommends installing these globally:

```sh
$ npm i -g @architect/architect aws-sdk
```

## Stack Setup

- Sign up for an AWS account. [AWS][signup]
- Set up some database tables
  - open up `app.arc` to get started

## Deployment

- Deploys to a staging environment happen automatically when you push your code to the `main` branch.

## Where the crap do I find my Cloudformation?

You can find the Cloudformation template that Architect generated for you in the sam.yaml file.

To find it on AWS, you can search for [Cloudformation][cloudformation] (make sure you're looking at the correct region!) and find the name of your stack that matches what's in `app.arc`

To find your deployed api, you can search for [APIGateway][apigateway] (make sure you're looking at the correct region!)

To find your deployed lambda functions, you can search for [Lambda][lambda] (make sure you're looking at the correct region!)

[signup]: https://portal.aws.amazon.com/billing/signup#/start
[cloudformation]: https://console.aws.amazon.com/cloudformation/home
[apigateway]: https://console.aws.amazon.com/apigateway/main/apis
[lambda]: https://console.aws.amazon.com/lambda/home
