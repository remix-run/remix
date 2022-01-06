import * as React from "react";
import type { User } from "~/models";
import cx from "clsx";

function Avatar({
  className,
  style,
  avatar,
  nameFirst,
  nameLast,
  size = "md"
}: AvatarProps) {
  if (!avatar && !nameFirst && !nameLast) {
    return null;
  }

  const sharedClassName = cx(className, "ui--avatar", `ui--avatar--${size}`);
  const fullName = [nameFirst, nameLast].filter(Boolean).join(" ").trim();
  if (!avatar) {
    return (
      <div
        className={cx(sharedClassName, "ui--avatar--initials")}
        style={style}
        title={fullName}
      >
        <AvatarInits name={fullName} />
      </div>
    );
  }
  return (
    <div className={sharedClassName} style={style} title={fullName}>
      <img src={avatar} alt="" />
    </div>
  );
}

function AvatarInits({ name }: { name: string }) {
  const inits = React.useMemo(() => {
    let inits: string[] | string | undefined = name
      .split(" ")
      .filter(filterMinorWords);

    if (inits.length > 1) {
      inits = (inits[0][0] + inits[1][0]).toUpperCase();
    } else {
      inits = inits[0].substring(0, 1).toUpperCase();
    }
    return inits;
  }, [name]);
  return <span className="ui--avatar__initials">{inits}</span>;
}

export { Avatar };

function filterMinorWords(string: string): boolean {
  return !["the", "a", "an", "and"].includes(string);
}

interface AvatarProps extends Partial<User> {
  size?: "sm" | "md" | "lg" | "xl" | "2x";
  className?: string;
  style?: React.ComponentProps<"div">["style"];
}
