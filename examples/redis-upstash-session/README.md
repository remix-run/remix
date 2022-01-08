# Redis Session Storage Using Upstash Example

An example of creating custom Redis session using [Upstash](https://upstash.com/).

When deploying on serverless infrastructure, it's impossible to use the core `createFileSessionStorage` option as there is no persistent file storage.

In this example we use Redis (Upstash) to store the session info.

## Preview

Sorry no preview as you'll need an account on Upstash for it
## Example

### Prerequisites 
- Create a free account at https://upstash.com/
- Create a new Redis database
- Duplicate the local `.env.example` file to `.env` and change the URL & Token environment variables
with your database info.
- Run `$ npm install`
- Run `$ npm run dev`

## Usage 

- The first time you run the project you a new session will be created for you and saved on `Upstash`
- If you refresh before the session expires (10 secs) the page you'll see the session's info.
- After the has expired you'll get back to square one and create a new session.
 
 For more info check the following files:

- [app/routes/index.tsx](app/routes/index.tsx)
- [app/sessions.server.ts](app/sessions.server.ts)
- [app/sessions/upstash.server.ts](app/sessions/upstash.server.ts)

## Related Links

- https://upstash.com/



