CREATE MIGRATION m1qprzg674yizplvyzqtrct37poxk5aacyzgjlq6jdfemrkf4puoba
    ONTO initial
{
  CREATE TYPE default::Joke {
      CREATE REQUIRED PROPERTY content -> std::str;
      CREATE REQUIRED PROPERTY createdAt -> std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE REQUIRED PROPERTY name -> std::str;
  };
  CREATE TYPE default::User {
      CREATE REQUIRED PROPERTY createdAt -> std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE REQUIRED PROPERTY passwordHash -> std::str;
      CREATE REQUIRED PROPERTY username -> std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::Joke {
      CREATE REQUIRED LINK jokester -> default::User {
          ON TARGET DELETE  DELETE SOURCE;
      };
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK jokes := (.<jokester[IS default::Joke]);
  };
};
