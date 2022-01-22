# Form to Notion DB

A simple way to post form data to a [Notion](https://www.notion.so/) DB.

## Setup

1. Create a Table page in Notion, and add columns:

- Firstname
- Lastname
- Email

2. Head over to the [Notion API Documentation](https://developers.notion.com/) to generate an API key. You will have to click the `My integrations` on the top right to create an integration and generate an API key.

3. Go back to your Notion page, click `Share` in the top right, and search for the integration you just created and give it access to the DB. In the same `Share` dialog, click `Copy Link`. This will give you a link to your page.
   It should look something like this:
   https://www.notion.so/{DB-ID}?v={PAGE-ID}

4. Copy the `DB-ID` from the URL and add it to the `.env` file under the key `NOTION_DB_ID`.
   Also add your API key to the `NOTION_TOKEN` key.

5. Run `npm run dev` to start up remix, and submit your form!

## Key Files

1. [.env](./.env) - Stores your Notion integration key and DB ID.
2. [package.json](./package.json) - the `dev` script is modified to use dotenv

```
"dev": "node -r dotenv/config node_modules/.bin/remix dev",
```

3. [notion.server.ts](./app/notion.server.ts) - Initializes the Notion client and exports it for use across your application.
4. [root.tsx](./app/root.tsx) - imports the notion client from the `notion.server.ts` file, and calls the Notion API with the submitted form data via the action function.
