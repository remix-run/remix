import * as React from "react";
import cx from "clsx";
import type { User } from "~/models";

const AuthHeader: React.VFC<{
  className?: string;
  onLogOut?(event: React.FormEvent<HTMLFormElement>): void;
  user: User;
}> = ({ className, user, onLogOut }) => {
  return (
    <header className={cx(className)}>
      <div>
        <div>
          <p>
            You are currently logged in as <strong>{user.email}</strong>.
          </p>
          <form action="/logout" method="post" onSubmit={onLogOut}>
            <button type="submit">Log Out</button>
          </form>
        </div>
      </div>
    </header>
  );
};

export { AuthHeader };
