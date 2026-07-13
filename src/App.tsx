import { OfficeActionConnector } from '@/components/OfficeActionConnector'
import { OfficeBottomToolbar } from '@/components/OfficeBottomToolbar'
import { OfficeCanvas } from '@/components/OfficeCanvas'
import { OfficeHeaderStats } from '@/components/OfficeHeaderStats'
import { OfficeRightPanel } from '@/components/OfficeRightPanel'
import { OfficeSidebar } from '@/components/OfficeSidebar'
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
