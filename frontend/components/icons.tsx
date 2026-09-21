import type { CSSProperties, HTMLAttributes } from "react";

type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, "color"> & {
  width?: number | string;
  height?: number | string;
};

const iconPath = (name: string) => `/icons/${name}.svg`;

function WindowsIcon({
  name,
  width = 24,
  height = 24,
  style,
  className,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  ...props
}: IconProps & { name: string }) {
  const mask = `url("${iconPath(name)}")`;
  const iconStyle: CSSProperties = {
    display: "inline-block",
    width,
    height,
    flexShrink: 0,
    verticalAlign: "middle",
    backgroundColor: "currentColor",
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    ...style,
  };

  return (
    <span
      {...props}
      className={className}
      style={iconStyle}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : (ariaHidden ?? true)}
      data-icon={name}
    />
  );
}

const createIcon = (name: string) => function Icon(props: IconProps) {
  return <WindowsIcon name={name} {...props} />;
};

export const IconShieldCheck = createIcon("shield-check");
export const IconUserCheck = createIcon("user");
export const IconUsers = createIcon("users");
export const IconSkill = createIcon("lightbulb");
export const IconGradCap = createIcon("graduation-cap");
export const IconBriefcase = createIcon("briefcase");
export const IconLaptop = createIcon("laptop");
export const IconTarget = createIcon("target");
export const IconChart = createIcon("chart");
export const IconInstitution = createIcon("institution");
export const IconSearch = createIcon("search");
export const IconFilter = createIcon("filter");
export const IconCalendar = createIcon("calendar");
export const IconDoc = createIcon("document");
export const IconLocation = createIcon("location");
export const IconIdCard = createIcon("id-card");
export const IconSpark = createIcon("sparkle");
export const IconArrowRight = createIcon("arrow-right");
export const IconCheck = createIcon("check");
export const IconTrendingUp = createIcon("trending-up");
export const IconLogout = createIcon("logout");
export const IconMenu = createIcon("menu");
export const IconBell = createIcon("notification");
export const IconChevronDown = createIcon("chevron-down");
export const IconClose = createIcon("close");
export const IconHome = createIcon("home");
export const IconRupee = createIcon("rupee");
