module default {

  type User {
    required property createdAt -> datetime {
      default := datetime_current();
    }
    required property username -> str { constraint exclusive; };
    required property passwordHash -> str;
    multi link jokes := .<jokester[is Joke];
  }

  type Joke {
    required link jokester -> User {
      on target delete delete source;
    }
    required property createdAt -> datetime {
      default := datetime_current();
    }
    required property name -> str;
    required property content -> str;
  }

}
