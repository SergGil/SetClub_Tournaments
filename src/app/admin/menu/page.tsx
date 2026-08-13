import { PencilIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { DeleteMenuItemButton } from "@/components/admin/delete-menu-item-button";
import { DeleteMenuSectionButton } from "@/components/admin/delete-menu-section-button";
import { MenuItemDialog } from "@/components/admin/menu-item-dialog";
import { MenuSectionDialog } from "@/components/admin/menu-section-dialog";
import { MenuToggleActiveButton } from "@/components/admin/menu-toggle-active-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleMenuItemActiveAction, toggleMenuSectionActiveAction } from "@/lib/actions/menu";
import { isDomainAdmin } from "@/lib/permissions";
import { getMenuSections } from "@/lib/queries/menu";
import { publicPhotoUrl } from "@/lib/r2";
import { MENU_LAYOUT_LABEL } from "@/lib/validation/menu";

export default async function AdminMenuPage() {
  if (!(await isDomainAdmin("COFFEE"))) {
    redirect("/admin");
  }

  const sections = await getMenuSections();
  const sectionOptions = sections.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/80">
          {sections.length > 0
            ? `${sections.length} ${sections.length === 1 ? "секція" : "секцій"} меню кав'ярні.`
            : "Ще немає жодної секції меню."}
        </p>
        <MenuSectionDialog
          trigger={
            <Button>
              <PlusIcon /> Додати секцію
            </Button>
          }
        />
      </div>

      {sections.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Почніть із секції — наприклад &laquo;Кава&raquo; (список) або &laquo;Special Menu&raquo; (картки).
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
                <DeleteMenuSectionButton id={section.id} name={section.name} itemCount={section.items.length} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {section.items.length === 0 && (
                <p className="text-sm text-muted-foreground">Ще немає напоїв у цій секції.</p>
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
