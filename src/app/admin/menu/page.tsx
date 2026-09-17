import { PencilIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { CoffeeHeroForm } from "@/components/admin/coffee-hero-form";
import { DeleteMenuItemButton } from "@/components/admin/delete-menu-item-button";
import { DeleteMenuSectionButton } from "@/components/admin/delete-menu-section-button";
import { MenuItemDialog } from "@/components/admin/menu-item-dialog";
import { MenuSectionDialog } from "@/components/admin/menu-section-dialog";
import { MenuToggleActiveButton } from "@/components/admin/menu-toggle-active-button";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleMenuItemActiveAction, toggleMenuSectionActiveAction } from "@/lib/actions/menu";
import { isDomainAdmin } from "@/lib/permissions";
import { getCoffeePageSettings } from "@/lib/queries/coffee-settings";
import { getMenuSections } from "@/lib/queries/menu";
import { publicPhotoUrl } from "@/lib/r2";
import { MENU_LAYOUT_LABEL } from "@/lib/validation/menu";

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isDomainAdmin("COFFEE"))) {
    redirect("/admin");
  }

  const { q: query } = await searchParams;
  const [allSections, heroSettings] = await Promise.all([getMenuSections(), getCoffeePageSettings()]);
  const normalizedQuery = query?.trim().toLowerCase();
  // Sections stay in their admin-chosen sortOrder either way (not
  // alphabetized/paginated by LoadMore like the flat lists elsewhere) -
  // reordering across sections needs the whole menu visible at once. Search
  // only narrows which sections/items are shown, keeping items whose own
  // name matches even if their section's name doesn't.
  const filteredSections = normalizedQuery
    ? allSections
        .map((section) => ({
          ...section,
          items: section.name.toLowerCase().includes(normalizedQuery)
            ? section.items
            : section.items.filter((item) => item.name.toLowerCase().includes(normalizedQuery)),
        }))
        .filter((section) => section.name.toLowerCase().includes(normalizedQuery) || section.items.length > 0)
    : allSections;
  // Real total, not the search-narrowed items[] above - the delete
  // confirmation's cascade warning must reflect what actually gets deleted,
  // not just what's currently visible under a search filter.
  const sections = filteredSections.map((section) => ({
    ...section,
    totalItemCount: allSections.find((s) => s.id === section.id)!.items.length,
  }));
  const sectionOptions = allSections.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-col gap-6">
      <CoffeeHeroForm heroTitle={heroSettings.heroTitle} heroSubtitle={heroSettings.heroSubtitle} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/80">
          {allSections.length > 0
            ? `${allSections.length} ${allSections.length === 1 ? "секція" : "секцій"} меню кав'ярні.`
            : "Ще немає жодної секції меню."}
        </p>
        <div className="flex items-center gap-2">
          <SearchInput placeholder="Пошук секції чи напою…" defaultValue={query} />
          <MenuSectionDialog
            trigger={
              <Button>
                <PlusIcon /> Додати секцію
              </Button>
            }
          />
        </div>
      </div>

      {allSections.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Почніть із секції — наприклад &laquo;Кава&raquo; (список) або &laquo;Special Menu&raquo; (картки).
        </p>
      )}
      {allSections.length > 0 && sections.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Нічого не знайдено за запитом «{query}».
        </p>
      )}

      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <p className="font-medium">{section.name}</p>
                {section.tagline && <p className="text-xs text-muted-foreground">{section.tagline}</p>}
                <Badge variant="secondary">{MENU_LAYOUT_LABEL[section.layout]}</Badge>
                {!section.active && <Badge variant="secondary">Приховано</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <MenuToggleActiveButton
                  id={section.id}
                  active={section.active}
                  action={toggleMenuSectionActiveAction}
                />
                <MenuSectionDialog
                  section={section}
                  trigger={
                    <Button variant="ghost" size="icon-sm">
                      <PencilIcon />
                      <span className="sr-only">Редагувати секцію</span>
                    </Button>
                  }
                />
                <DeleteMenuSectionButton id={section.id} name={section.name} itemCount={section.totalItemCount} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {section.items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {normalizedQuery ? "Немає напоїв за цим запитом у цій секції." : "Ще немає напоїв у цій секції."}
                </p>
              )}
              {section.items.map((item) => {
                const photoUrl = item.photoKey ? publicPhotoUrl(item.photoKey) : null;
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      {photoUrl && (
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md">
                          <Image src={photoUrl} alt="" fill sizes="48px" className="object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {item.name} <span className="text-muted-foreground">— {item.price} грн</span>
                          {!item.active && (
                            <Badge variant="secondary" className="ml-2">
                              Приховано
                            </Badge>
                          )}
                        </p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <MenuToggleActiveButton
                        id={item.id}
                        active={item.active}
                        action={toggleMenuItemActiveAction}
                      />
                      <MenuItemDialog
                        sections={sectionOptions}
                        item={{ ...item, photoUrl }}
                        trigger={
                          <Button variant="ghost" size="icon-sm">
                            <PencilIcon />
                            <span className="sr-only">Редагувати напій</span>
                          </Button>
                        }
                      />
                      <DeleteMenuItemButton id={item.id} name={item.name} />
                    </div>
                  </div>
                );
              })}
              <MenuItemDialog
                sections={sectionOptions}
                defaultSectionId={section.id}
                trigger={
                  <Button variant="outline" size="sm" className="self-start">
                    <PlusIcon /> Додати напій
                  </Button>
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
