import React, {type ReactNode} from 'react';
import {AdminSessionProvider} from '@site/src/components/AdminSession';

export default function Root({children}: {children: ReactNode}) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
