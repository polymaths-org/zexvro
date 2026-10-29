import {render,screen,fireEvent} from '@testing-library/react';import {describe,it,expect,vi} from 'vitest';
import LegacyLocalRecovery from './LegacyLocalRecovery';
describe('legacy wallet recovery',()=>{
 it('does not show a recovery export when no older state exists',()=>{render(<LegacyLocalRecovery/>);expect(screen.queryByRole('button')).toBeNull()});
 it('exports preserved data only on request and never displays the key contents',()=>{localStorage.setItem('zexvro_user_treasury_v1','private-fixture-do-not-display');const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});render(<LegacyLocalRecovery/>);expect(screen.queryByText('private-fixture-do-not-display')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Download older wallet data'}));expect(click).toHaveBeenCalledOnce();expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));click.mockRestore()});
});
