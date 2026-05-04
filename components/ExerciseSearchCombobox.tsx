"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Exercise } from "@/lib/types";
import { searchExercises, HEVY_EXERCISES } from "@/lib/hevy/exercises";

interface ExerciseSearchComboboxProps {
  currentExerciseTitle: string;
  onExerciseSelect: (exercise: Exercise) => void;
}

export function ExerciseSearchCombobox({
  currentExerciseTitle,
  onExerciseSelect,
}: ExerciseSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Convert Hevy template to Exercise type
  const convertToExercise = (hevyEx: any): Exercise => ({
    id: hevyEx.id,
    title: hevyEx.title,
    type: hevyEx.type as Exercise["type"],
    primary_muscle_group: hevyEx.primary_muscle_group,
    secondary_muscle_groups: hevyEx.secondary_muscle_groups,
    is_custom: hevyEx.is_custom,
  });

  // Filtered list:
  // - empty query → top 50 closest matches to currentExerciseTitle
  // - typed query → top 50 matches to query
  const [filteredExercises, setFilteredExercises] = React.useState<typeof HEVY_EXERCISES>(
    () => HEVY_EXERCISES.slice(0, 50),
  );

  React.useEffect(() => {
    let cancelled = false;
    const query = searchQuery.trim().length > 0 ? searchQuery : currentExerciseTitle;
    if (!query) {
      setFilteredExercises(HEVY_EXERCISES.slice(0, 50));
      return;
    }
    searchExercises(query, 50).then((results) => {
      if (!cancelled) {
        setFilteredExercises(
          results.length > 0 ? results : HEVY_EXERCISES.slice(0, 50),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, currentExerciseTitle, open]);

  const handleSelect = (exercise: any) => {
    onExerciseSelect(convertToExercise(exercise));
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-0 hover:bg-transparent h-auto font-semibold text-xl text-foreground hover:text-foreground/80"
        >
          <span className="truncate">{currentExerciseTitle}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[90vw] max-w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search exercises..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>No exercises found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {filteredExercises.map((exercise) => (
                <CommandItem
                  key={exercise.id}
                  value={exercise.id}
                  onSelect={() => handleSelect(exercise)}
                  className="flex items-start gap-2 py-2"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary shrink-0 mt-0.5">
                    <Dumbbell className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {exercise.title}
                      </span>
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          currentExerciseTitle === exercise.title
                            ? "opacity-100 text-foreground"
                            : "opacity-0"
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize">{exercise.equipment}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {exercise.primary_muscle_group.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

