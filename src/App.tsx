import { OfficeActionConnector } from '@/components/OfficeActionConnector'
import { OfficeCanvas } from '@/components/OfficeCanvas'
import {
  OfficeBottomToolbar,
  OfficeHeaderStats,
  OfficeRightPanel,
  OfficeSidebar,
} from '@/components/OfficeDashboardChrome'
import './App.css'

function App() {
  return (
    <div className="office-app">
      <OfficeActionConnector />
      <OfficeSidebar />
      <div className="office-center">
        <OfficeHeaderStats />
        <main className="office-main">
          <OfficeCanvas />
          <OfficeBottomToolbar />
        </main>
      </div>
      <OfficeRightPanel />
    </div>
  )
}

export default App
