; Remove installer language/path preferences, preserving the user's music library.
!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty SHCTX "${MANUKEY}"
!macroend
