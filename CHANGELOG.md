# Changelog

## 0.1.25

- Support BlockNote ^0.33


## 0.1.24

- Change the BlockNoteEditor to be a type parameter instead, as mismatched
  versions were still unhappy due to subclass checks.

## 0.1.23

- Enable passing in the BlockNoteEditor in the useBlockNoteSync hook to avoid
  type errors when passing the resulting editor to BlockNoteView.
