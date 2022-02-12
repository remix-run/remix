# Remix Architect (AWS) Stack

- [Remix Docs](https://remix.run/docs)

## Architect Setup

1. Globally install Architect and the AWS SDK

```sh
npm i -g @architect/architect aws-sdk
```

2. [Sign up][signup] and login to your AWS account
   - To login with the CLI, you'll need to generate `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, you can do so from your [security credentials][aws_access_key_id] and click on the "Access keys" tab, and then click "Create New Access Key", and then download and open the credentials file.
   - Next, run `aws configure` and paste in your credentials.

## Development

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

This is a pretty simple note-taking app, but it's a good example of how you can build a full stack app with Architect and Remix. The main functionality is creating users, logging in and out, and creating and deleting notes.

### Relevant code:

- creating users, and logging in and out [./app/models/user.server.ts](./app/models/user.server.ts)
- user sessions, and verifying them [./app/session.server.ts](./app/session.server.ts)
- creating, and deleting notes [./app/models/note.server.ts](./app/models/note.server.ts)

The database that comes with `arc sandbox` is an in memory database, so if you restart the server, you'll lose your data. The Staging and Production environments won't behave this way, instead they'll persist the data in dynamoDB between deployments and Lambda executions.

## Deployment

This Remix Stack comes with two GitHub actions that handle automatically deploying your app to production and staging environments. By default, Arc will deploy to the `us-west-2` region, if you wish to deploy to a different region, you'll need to change your [`app.arc`](https://arc.codes/docs/en/reference/project-manifest/aws)

Prior to your first deployment, you'll need to do a few things:

- Create a new [GitHub repo](https://repo.new)

- Make sure you have your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` saved to your GitHub repo's secrets. You can re-use the ones you used for the AWS CLI or you can go to your AWS [security credentials][aws_access_key_id] and click on the "Access keys" tab, and then click "Create New Access Key", then you can copy those and add them to your repo's secrets.

Along with your AWS credentials, you'll also need to give your CloudFormation a `SESSION_SECRET` variable of its own for both staging and production environments.

```sh
arc env staging SESSION_SECRET $(openssl rand -hex 32)
arc env production SESSION_SECRET $(openssl rand -hex 32)
```

> If you don't have openssl installed, you can also use [1password][generate_password] to generate a random secret, just replace `$(openssl rand -hex 32)` with the generated secret.

## Where do I find my CloudFormation?

You can find the CloudFormation template that Architect generated for you in the sam.yaml file.

To find it on AWS, you can search for [CloudFormation][cloudformation] (make sure you're looking at the correct region!) and find the name of your stack (the name is a PascalCased version of what you have in `app.arc`, so by default it's RemixAwsStackStaging) that matches what's in `app.arc`, you can find all of your app's resources under the "Resources" tab.

[signup]: https://portal.aws.amazon.com/billing/signup#/start
[cloudformation]: https://console.aws.amazon.com/cloudformation/home
[aws_access_key_id]: https://console.aws.amazon.com/iam/home?region=us-west-2#/security_credentials
[generate_password]: https://1password.com/password-generator
