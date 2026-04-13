"use client";

import { ActionIcon, Tooltip } from "@mantine/core";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

type SavedListingButtonProps = {
  listingId: string;
  isSaved: boolean;
  disabled?: boolean;
  onToggle: (listingId: string, nextSaved: boolean) => void;
};

export function SavedListingButton({ listingId, isSaved, disabled, onToggle }: SavedListingButtonProps) {
  return (
    <Tooltip label={isSaved ? "Odebrat z oblíbených" : "Uložit do oblíbených"} withArrow>
      <ActionIcon
        variant={isSaved ? "filled" : "default"}
        color={isSaved ? "red" : "gray"}
        aria-label={isSaved ? "Unsave listing" : "Save listing"}
        disabled={disabled}
        onClick={() => onToggle(listingId, !isSaved)}
      >
        {isSaved ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}
