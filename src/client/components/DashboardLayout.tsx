import { useEffect, useState } from "react";
import { FilePlus2, FileQuestion, X } from "lucide-react";
import { Link, Redirect, Route, Switch, useLocation, useRoute } from "wouter";
import type { UserInfo } from "../auth";
import { ActivityPage, SettingsPage } from "../ManagementPages";
import { InboxPage } from "../screens/inbox/InboxPage";
import { NewFormDialog } from "../screens/inbox/NewFormDialog";
import { AppHeader } from "./AppHeader";
import { Brand } from "./Brand";
import { FormsSidebar } from "./FormsSidebar";
import { useForms } from "./FormsProvider";
import { Button } from "./ui/button";
import { DialogClose } from "./ui/dialog";
import { EmptyState } from "./ui/empty-state";
import { Sheet, SheetContent } from "./ui/sheet";
import { Skeleton } from "./ui/skeleton";

function InboxSkeleton() {
  return (
    <div className="grid flex-1 content-start gap-3 px-4 pt-7 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-11 max-w-2xl rounded-xl" />
      <Skeleton className="mt-6 h-[50vh] rounded-2xl" />
    </div>
  );
}

function FormsArea({ onNewForm }: { onNewForm: () => void }) {
  const { forms } = useForms();
  const [location] = useLocation();
  const [, detail] = useRoute("/forms/:formId/submissions/:submissionId");
  const [, single] = useRoute("/forms/:formId");
  const formId = detail?.formId ?? single?.formId;
  const form = forms?.find((entry) => entry.id === formId);

  if (forms && !formId) {
    if (location !== "/") return <Redirect to="/" replace />;
    if (forms.length) return <Redirect to={`/forms/${forms[0].id}`} replace />;
  }

  let main;
  if (forms === null) main = <InboxSkeleton />;
  else if (!formId) {
    main = (
      <EmptyState icon={<FilePlus2 />} title="Create your first form" className="self-center" action={<Button onClick={onNewForm}>New form</Button>}>
        Each form gets an endpoint you can post to from any site, and an inbox for what arrives.
      </EmptyState>
    );
  } else if (!form) {
    main = (
      <EmptyState icon={<FileQuestion />} title="Form not found" className="self-center" action={<Button variant="secondary" asChild><Link href="/">Go to your forms</Link></Button>}>
        It may have been deleted, or the link is incomplete.
      </EmptyState>
    );
  } else main = <InboxPage key={form.id} form={form} submissionId={detail?.submissionId ?? null} />;

  return (
    <>
      <aside className="hidden w-[272px] shrink-0 border-r border-line bg-surface/50 lg:flex lg:flex-col" aria-label="Forms">
        <FormsSidebar forms={forms} activeId={formId} onNewForm={onNewForm} className="flex-1" />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{main}</div>
    </>
  );
}

export function DashboardLayout({ user, onSignOut }: { user: UserInfo; onSignOut: () => void }) {
  const [location] = useLocation();
  const { forms } = useForms();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [formsHref, setFormsHref] = useState("/");
  const onFormsPage = location === "/" || location.startsWith("/forms/");
  const activeFormId = /^\/forms\/([^/]+)/.exec(location)?.[1];

  // Close the drawer on navigation and let the Forms tab return to the last form viewed.
  useEffect(() => {
    setSheetOpen(false);
    if (activeFormId) setFormsHref(`/forms/${activeFormId}`);
  }, [location, activeFormId]);

  function openNewForm() {
    setSheetOpen(false);
    setNewFormOpen(true);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <AppHeader user={user} formsHref={formsHref} onOpenForms={onFormsPage ? () => setSheetOpen(true) : undefined} onSignOut={onSignOut} />
      <div className="flex min-h-0 flex-1">
        <Switch>
          <Route path="/activity"><ActivityPage /></Route>
          <Route path="/settings"><SettingsPage /></Route>
          <Route path="/"><FormsArea onNewForm={openNewForm} /></Route>
          <Route path="/forms/*"><FormsArea onNewForm={openNewForm} /></Route>
          <Route><Redirect to="/" replace /></Route>
        </Switch>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="Forms">
          <div className="flex h-15 shrink-0 items-center justify-between border-b border-line px-4">
            <Brand />
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close forms list"><X /></Button>
            </DialogClose>
          </div>
          <FormsSidebar forms={forms} activeId={activeFormId} onNewForm={openNewForm} className="flex-1" />
        </SheetContent>
      </Sheet>
      <NewFormDialog open={newFormOpen} onOpenChange={setNewFormOpen} />
    </div>
  );
}
