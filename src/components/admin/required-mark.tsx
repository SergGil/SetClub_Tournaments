/** Marks a form field's label as required - the "(опційно)" convention already used for optional fields only made sense once both halves existed. */
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
