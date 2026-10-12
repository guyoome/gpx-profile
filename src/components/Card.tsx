import type { ReactNode } from "react";
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";

let seq = 0;

type Props = {
  /** Section title. */
  title: string;
  /** Optional small icon shown to the left of the title. */
  icon?: ReactNode;
  /** Panel-level actions, shown on the right of the header. */
  actions?: ReactNode;
  /** Optional helper text under the title. */
  helper?: ReactNode;
  children: ReactNode;
};

/**
 * Editor panel built on the shadcn Card primitives. The whole card is a labelled
 * <section> with a real <h2> title (optional icon), a header actions slot and
 * optional helper text. Reusable for any future panel.
 */
export default function Card({ title, icon, actions, helper, children }: Props) {
  const titleId = `card-${++seq}-title`;
  return (
    <UICard
      role="region"
      aria-labelledby={titleId}
      className="gap-0 rounded-2xl py-6 ring-border [--card-spacing:--spacing(6)]"
    >
      <CardHeader className="items-center pb-5">
        <CardTitle
          id={titleId}
          role="heading"
          aria-level={2}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
        >
          {icon && (
            <span aria-hidden="true" className="leading-none">
              {icon}
            </span>
          )}
          {title}
        </CardTitle>
        {helper && <CardDescription className="max-w-xl text-[0.95rem] leading-relaxed">{helper}</CardDescription>}
        {actions && <CardAction className="self-center">{actions}</CardAction>}
      </CardHeader>
      <CardContent className="mx-(--card-spacing) border-t px-0 pt-5">{children}</CardContent>
    </UICard>
  );
}
