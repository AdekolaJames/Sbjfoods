import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn("flex aspect-video justify-center text-xs", className)}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => c.theme || c.color
  );

  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => {
            return `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] || item.color;
    return color ? `--color-${key}: ${color};` : "";
  })
  .join("\n")}
}
`;
          })
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean;
      indicator?: "dot" | "line" | "dashed";
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
    },
    ref
  ) => {
    const { config } = useChart();

    if (!active || !payload?.length) return null;

    return (
      <div ref={ref} className={cn("rounded-md border bg-background p-2 text-xs", className)}>
        {payload.map((item: any) => {
          const key = item.dataKey || item.name;
          const itemConfig = config[key] || {};

          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {itemConfig.label || key}
              </span>
              <span className="font-medium">
                {item.value?.toLocaleString?.() ?? item.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload">
>(({ className, payload }, ref) => {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div ref={ref} className={cn("flex gap-4", className)}>
      {payload.map((item: any) => {
        const itemConfig = config[item.dataKey];

        return (
          <div key={item.value} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span>{itemConfig?.label || item.value}</span>
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegend";


export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};