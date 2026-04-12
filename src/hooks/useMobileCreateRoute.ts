import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MOBILE_MAX_PX = 768;

export type UseMobileCreateRouteOptions = {
  listPath: string;
  novoPath: string;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  prepareCreate: () => void;
  resetModal: () => void;
};

/**
 * Fluxo mobile: navegar para `novoPath` abre o mesmo Dialog em ecrã completo (via MobileCreateFormDialogContent).
 * Desktop: `prepareCreate` + dialog normal.
 */
export function useMobileCreateRoute(opts: UseMobileCreateRouteOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const isNovoRoute = location.pathname === opts.novoPath;
  const [viewportMaxMd, setViewportMaxMd] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_PX,
  );
  const showMobileCreate = isNovoRoute && viewportMaxMd;

  const prepareRef = useRef(opts.prepareCreate);
  prepareRef.current = opts.prepareCreate;
  const resetRef = useRef(opts.resetModal);
  resetRef.current = opts.resetModal;
  const enterOnceRef = useRef(false);
  const sessionRef = useRef(false);

  useEffect(() => {
    const onResize = () => setViewportMaxMd(window.innerWidth < MOBILE_MAX_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isNovoRoute) return;
    if (window.innerWidth >= MOBILE_MAX_PX) {
      navigate(opts.listPath, { replace: true });
    }
  }, [isNovoRoute, navigate, opts.listPath]);

  useEffect(() => {
    if (showMobileCreate) {
      if (!enterOnceRef.current) {
        enterOnceRef.current = true;
        prepareRef.current();
      }
      sessionRef.current = true;
      opts.setDialogOpen(true);
    } else {
      enterOnceRef.current = false;
      if (sessionRef.current) {
        sessionRef.current = false;
        opts.setDialogOpen(false);
        resetRef.current();
      }
    }
  }, [showMobileCreate, opts.setDialogOpen]);

  const endMobileCreateFlow = useCallback(() => {
    sessionRef.current = false;
    enterOnceRef.current = false;
  }, []);

  const openCreateNavigateOrDialog = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_PX) {
      navigate(opts.novoPath);
      return;
    }
    prepareRef.current();
    opts.setDialogOpen(true);
  }, [navigate, opts.novoPath, opts.setDialogOpen]);

  const closeMobileCreate = useCallback(() => {
    sessionRef.current = false;
    enterOnceRef.current = false;
    opts.setDialogOpen(false);
    resetRef.current();
    navigate(opts.listPath);
  }, [navigate, opts.listPath, opts.setDialogOpen]);

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (showMobileCreate) {
          closeMobileCreate();
          return;
        }
        resetRef.current();
      }
      opts.setDialogOpen(open);
    },
    [showMobileCreate, closeMobileCreate, opts.setDialogOpen],
  );

  return {
    isNovoRoute,
    showMobileCreate,
    openCreateNavigateOrDialog,
    closeMobileCreate,
    onDialogOpenChange,
    endMobileCreateFlow,
  };
}
