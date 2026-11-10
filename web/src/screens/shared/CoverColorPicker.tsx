import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COVER_COLORS,
  coverPattern,
  isCoverColor,
  type CoverColor,
} from "@/data/model";
import "@/screens/workspace.css";

type Props = {
  /** The marked colour; undefined while none is chosen yet. */
  value: CoverColor | undefined;
  onChange: (color: CoverColor) => void;
  /** The story whose small cover is shown; a new story has none yet. */
  storyId?: string;
  disabled?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/**
 * The colour of a story's cover (openspec/specs/web/workspace, «Цвет обложки на странице
 * «История»», «Цвет обложки в диалоге новой истории»): the small cover and six samples.
 */
export function CoverColorPicker({
  value,
  onChange,
  storyId,
  disabled,
  ...aria
}: Props) {
  return (
    <div className="flex items-center gap-3">
      {storyId !== undefined && value !== undefined && (
        <span
          className="book-mini"
          data-cover={value}
          data-pattern={coverPattern(storyId)}
          aria-hidden
        />
      )}
      <ToggleGroup
        type="single"
        value={value ?? ""}
        // A click on the marked sample would clear the choice: a story always has a colour.
        onValueChange={(next) => {
          if (next === "") return;
          if (!isCoverColor(next))
            throw new Error(`Нет цвета обложки «${next}».`);
          onChange(next);
        }}
        disabled={disabled}
        spacing={1}
        className="flex-wrap"
        {...aria}
      >
        {Object.entries(COVER_COLORS).map(([color, label]) => (
          <ToggleGroupItem
            key={color}
            value={color}
            aria-label={label}
            className="size-9 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring"
          >
            <span className="cover-swatch size-5!" data-cover={color} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
