import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SearchableSelect } from "./searchable-select";

const OPTIONS = [
  { value: 1, label: "1 · C. Jose Street Extension" },
  { value: 2, label: "2 · EDSA" },
  { value: 3, label: "3 · Shaw Boulevard" },
];

afterEach(() => {
  cleanup();
});

test("shows the selected option's label when closed", () => {
  render(<SearchableSelect options={OPTIONS} value={2} onChange={() => {}} aria-label="Node" />);
  expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("2 · EDSA");
});

test("typing filters the list to matching options only", () => {
  render(<SearchableSelect options={OPTIONS} value={null} onChange={() => {}} aria-label="Node" />);
  fireEvent.focus(screen.getByRole("combobox"));
  expect(screen.getAllByRole("option")).toHaveLength(3);

  fireEvent.change(screen.getByRole("combobox"), { target: { value: "shaw" } });
  const visible = screen.getAllByRole("option");
  expect(visible).toHaveLength(1);
  expect(visible[0].textContent).toContain("Shaw Boulevard");
});

test("a query with no matches shows a no-matches row instead of the whole list", () => {
  render(<SearchableSelect options={OPTIONS} value={null} onChange={() => {}} aria-label="Node" />);
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
  expect(screen.getByText("No matches")).toBeTruthy();
  expect(screen.queryAllByRole("option")).toHaveLength(0);
});

test("clicking an option selects it and closes the list", () => {
  let selected: number | null = null;
  render(
    <SearchableSelect
      options={OPTIONS}
      value={null}
      onChange={(v) => (selected = v)}
      aria-label="Node"
    />,
  );
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.click(screen.getByText("3 · Shaw Boulevard"));

  expect(selected).toBe(3);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("a large option list only renders the capped slice, not every option", () => {
  const many = Array.from({ length: 9000 }, (_, i) => ({ value: i, label: `${i} · Node ${i}` }));
  render(
    <SearchableSelect
      options={many}
      value={null}
      onChange={() => {}}
      aria-label="Node"
      maxResults={50}
    />,
  );
  fireEvent.focus(screen.getByRole("combobox"));
  expect(screen.getAllByRole("option")).toHaveLength(50);
});
