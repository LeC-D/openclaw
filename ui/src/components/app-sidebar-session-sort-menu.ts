// Pure rendering for the sidebar grouping, sorting, and cron visibility menu.
import { html, nothing } from "lit";
import { t } from "../i18n/index.ts";
import type { SidebarSessionsGrouping } from "../lib/sessions/grouping.ts";
import { icons } from "./icons.ts";
import "./menu-surface.ts";

export type SidebarSessionSortMode = "created" | "updated";

const SORT_OPTIONS = [
  { mode: "created", labelKey: "chat.sidebar.sortCreated" },
  { mode: "updated", labelKey: "chat.sidebar.sortUpdated" },
] as const;

export function renderSidebarSessionSortMenu(params: {
  position: { x: number; y: number } | null;
  grouping: SidebarSessionsGrouping;
  sortMode: SidebarSessionSortMode;
  showCron: boolean;
  setGrouping: (grouping: SidebarSessionsGrouping) => void;
  setSortMode: (mode: SidebarSessionSortMode) => void;
  setShowCron: (show: boolean) => void;
  close: () => void;
}) {
  if (!params.position) {
    return nothing;
  }
  const groupingOptions = [
    { grouping: "category", label: t("sessionsView.groupByCategory") },
    { grouping: "none", label: t("sessionsView.groupByNone") },
  ] as const satisfies ReadonlyArray<{ grouping: SidebarSessionsGrouping; label: string }>;
  return html`
    <openclaw-menu-surface>
      <div
        class="sidebar-session-sort-menu"
        role="menu"
        aria-label=${t("chat.sidebar.sortSessions")}
        style="left: ${params.position.x}px; top: ${params.position.y}px;"
      >
        <div class="sidebar-session-sort-menu__title">${t("sessionsView.groupBy")}</div>
        ${groupingOptions.map(
          (option) => html`
            <button
              type="button"
              class="sidebar-session-sort-menu__item"
              role="menuitemradio"
              tabindex="-1"
              aria-checked=${String(params.grouping === option.grouping)}
              @click=${() => {
                params.setGrouping(option.grouping);
                params.close();
              }}
            >
              <span class="session-menu__check" aria-hidden="true">
                ${params.grouping === option.grouping ? icons.check : nothing}
              </span>
              <span class="session-menu__text">${option.label}</span>
            </button>
          `,
        )}
        <div class="session-menu__separator" role="separator"></div>
        <div class="sidebar-session-sort-menu__title">${t("chat.sidebar.sortBy")}</div>
        ${SORT_OPTIONS.map(
          (option) => html`
            <button
              type="button"
              class="sidebar-session-sort-menu__item"
              role="menuitemradio"
              tabindex="-1"
              aria-checked=${String(params.sortMode === option.mode)}
              @click=${() => {
                params.setSortMode(option.mode);
                params.close();
              }}
            >
              <span class="session-menu__check" aria-hidden="true">
                ${params.sortMode === option.mode ? icons.check : nothing}
              </span>
              <span class="session-menu__text">${t(option.labelKey)}</span>
            </button>
          `,
        )}
        <div class="session-menu__separator" role="separator"></div>
        <button
          type="button"
          class="sidebar-session-sort-menu__item"
          role="menuitemcheckbox"
          tabindex="-1"
          aria-checked=${String(params.showCron)}
          @click=${() => {
            params.setShowCron(!params.showCron);
            params.close();
          }}
        >
          <span class="session-menu__check" aria-hidden="true">
            ${params.showCron ? icons.check : nothing}
          </span>
          <span class="session-menu__text">${t("sessionsView.showCronSessions")}</span>
        </button>
      </div>
    </openclaw-menu-surface>
  `;
}
