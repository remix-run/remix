# Remix Architect (AWS) Stack

## Architect Setup

When deploying to AWS Lambda with Architect, you'll need:

- Architect (`arc`) CLI
- AWS SDK

Architect recommends installing these globally:

```sh
$ npm i -g @architect/architect@RC aws-sdk
```

## Stack Setup

- Sign up for an AWS account. [AWS][signup]
- Set up some database tables
  - open up `app.arc` to get started

## Development

```sh
$ echo SESSION_SECRET=$(openssl rand -hex 32) >> .env
$ npm run dev
```

The database that comes with `arc sandbox` is an in memory database, so if you restart the server, you'll lose your data. Production environments won't behave this way.

## Deployment

This Remix Stack comes with two GitHub actions that handle automatically deploying your app to production and staging environments.

Prior to your first deployment, you'll need to make sure you have your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` saved to your GitHub repo's secrets. To do this, you can go to your AWS [security credentials][aws_access_key_id] and click on the "Access keys" tab, and then click "Create New Access Key", then you can copy those and add them to your repo's secrets.

Along with your AWS credentials, you'll also need to give your CloudFormation a `SESSION_SECRET` variable of its own for both staging and production environments.

```sh
$ arc env staging SESSION_SECRET $(openssl rand -hex 32)
$ arc env production SESSION_SECRET $(openssl rand -hex 32)
```

## Where do I find my CloudFormation?

You can find the CloudFormation template that Architect generated for you in the sam.yaml file.

To find it on AWS, you can search for [CloudFormation][cloudformation] (make sure you're looking at the correct region!) and find the name of your stack that matches what's in `app.arc`

To find your deployed api, you can search for [APIGateway][apigateway] (make sure you're looking at the correct region!)

To find your deployed lambda functions, you can search for [Lambda][lambda] (make sure you're looking at the correct region!)

[signup]: https://portal.aws.amazon.com/billing/signup#/start
[cloudformation]: https://console.aws.amazon.com/cloudformation/home
[apigateway]: https://console.aws.amazon.com/apigateway/main/apis
[lambda]: https://console.aws.amazon.com/lambda/home
[aws_access_key_id]: https://console.aws.amazon.com/iam/home?region=us-east-1#/security_credentials
