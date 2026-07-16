import { css, type Handle } from "remix/ui";
import button from "remix/ui/button";
import { Tabs, TabList, Tab, TabPanel } from "remix/ui/tabs";

/**
 * @name Tabs Basic
 * @description Styled tabs with controlled and uncontrolled state.
 * @layout center
 */
export function TabsBasic(handle: Handle) {
  let activeTab = "week";

  return () => (
    <div mix={tabsDemoCss}>
      <Tabs defaultActiveTab="overview">
        <div mix={tabsHeaderCss}>
          <TabList aria-label="Project sections">
            <Tab name="overview">Overview</Tab>
            <Tab name="activity">Activity</Tab>
            <Tab name="settings">Settings</Tab>
          </TabList>
          <button mix={button()}>New</button>
        </div>
        <TabPanel name="overview">Project health, owner notes, and current milestones.</TabPanel>
        <TabPanel name="activity">Recent commits, deploys, and review handoffs.</TabPanel>
        <TabPanel name="settings">Visibility, notifications, and billing preferences.</TabPanel>
      </Tabs>

      <Tabs
        activeTab={activeTab}
        onActiveTabChange={(nextActiveTab) => {
          activeTab = nextActiveTab;
          void handle.update();
        }}
        size="lg"
      >
        <div mix={tabsHeaderCss}>
          <TabList aria-label="Report timeframe">
            <Tab name="day">Day</Tab>
            <Tab name="week">Week</Tab>
            <Tab name="month">Month</Tab>
          </TabList>
          <button mix={button({ size: "lg" })}>Share</button>
        </div>
        <TabPanel name="day">Daily snapshot selected.</TabPanel>
        <TabPanel name="week">Weekly trend selected.</TabPanel>
        <TabPanel name="month">Monthly rollup selected.</TabPanel>
      </Tabs>
    </div>
  );
}

const tabsDemoCss = css({
  display: "grid",
  gap: "28px",
  width: "28rem",
  maxWidth: "100%",
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
});

const tabsHeaderCss = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
});
